import express from 'express';
import { requireAuth } from './auth.js';
import {
  appendAudit,
  appendMissionEvent,
  createProductMission,
  deleteGithubConfig,
  getGithubConfig,
  getProductMission,
  listMissionEvents,
  listProductMissions,
  transitionProductMission,
  upsertGithubConfig,
} from './db.js';
import { decrypt, encrypt, isEncrypted } from './encryption.js';
import { decryptSecrets, encryptSecrets, memberOrFail } from './workspaces.js';
import { getProviderForRequest } from './llmRoutes.js';
import { hashMissionProposal, investigateMission } from './missionEngine.js';
import {
  createMissionPullRequest,
  getMissionPullRequestValidation,
  isConfigured as githubConfigured,
  verifyRepositoryAccess,
} from './agent/github.js';

const MISSION_STATUSES = new Set([
  'draft',
  'investigating',
  'needs_input',
  'proposed',
  'approving',
  'awaiting_validation',
  'ready_for_review',
  'validation_failed',
  'failed',
  'rejected',
]);

function cleanText(value, maxLength) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function validateRepository(value) {
  if (!value) return '';
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(value)) {
    const error = new Error('repository must use owner/name format');
    error.status = 400;
    error.field = 'repository';
    throw error;
  }
  return value;
}

function validateAppUrl(value) {
  if (!value) return '';
  let url;
  try { url = new URL(value); } catch {
    const error = new Error('app_url must be a valid URL');
    error.status = 400;
    error.field = 'app_url';
    throw error;
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    const error = new Error('app_url must use http or https');
    error.status = 400;
    error.field = 'app_url';
    throw error;
  }
  return url.toString();
}

function validateMissionInput(value = {}, defaultRepository = process.env.GITHUB_REPO || '') {
  const title = cleanText(value.title, 120);
  const outcome = cleanText(value.outcome, 1_000);
  const evidence = cleanText(value.evidence, 30_000);
  if (title.length < 3) {
    const error = new Error('title must be at least 3 characters');
    error.status = 400;
    error.field = 'title';
    throw error;
  }
  if (outcome.length < 8) {
    const error = new Error('outcome must describe the result the user should experience');
    error.status = 400;
    error.field = 'outcome';
    throw error;
  }
  if (evidence.length < 20) {
    const error = new Error('evidence must include the real problem, expected result, and what happened instead');
    error.status = 400;
    error.field = 'evidence';
    throw error;
  }
  return {
    title,
    outcome,
    evidence,
    repository: validateRepository(cleanText(value.repository, 200) || cleanText(defaultRepository, 200)),
    app_url: validateAppUrl(cleanText(value.app_url, 2_000)),
    source_type: cleanText(value.source_type, 50) || 'manual',
  };
}

function maskToken(value) {
  const token = String(value || '');
  if (!token) return '';
  if (token.length <= 10) return '********';
  return `${token.slice(0, 4)}...${token.slice(-4)}`;
}

async function githubOptionsForWorkspace(workspaceId) {
  const stored = await getGithubConfig(workspaceId);
  if (stored) {
    let token;
    try { token = decrypt(stored.token_enc); } catch {
      const error = new Error('The workspace GitHub credential cannot be decrypted. Reconnect GitHub.');
      error.status = 500;
      error.code = 'github_config_unreadable';
      throw error;
    }
    return { token, repo: stored.default_repository, source: 'workspace', stored };
  }
  return {
    token: process.env.GITHUB_TOKEN || '',
    repo: process.env.GITHUB_REPO || '',
    source: process.env.GITHUB_TOKEN ? 'server' : 'none',
    stored: null,
  };
}

function publicGithubConfig(options, { includeTokenPreview = false } = {}) {
  const config = {
    configured: githubConfigured(options),
    default_repository: options.repo || '',
    ready: githubConfigured(options),
    source: options.source,
    updated_at: options.stored?.updated_at || null,
  };
  if (includeTokenPreview) config.token_preview = options.token ? maskToken(options.token) : '';
  return config;
}

function bindValidationToApproval(validation, pullRequest, proposal) {
  const failures = [];
  if (!pullRequest?.head_sha || validation?.head_sha !== pullRequest.head_sha) {
    failures.push('The pull request head no longer matches the exact approved commit.');
  }
  if (validation?.pull_request_state !== 'open') {
    failures.push('The pull request is no longer open.');
  }
  if (validation?.draft !== true) {
    failures.push('The pull request is no longer a draft.');
  }
  if (!validation?.base_sha || validation.base_sha !== proposal?.base_sha) {
    failures.push('The pull request base no longer matches the investigated commit.');
  }
  if (!validation?.base_branch || validation.base_branch !== proposal?.default_branch) {
    failures.push('The pull request target branch no longer matches the investigated branch.');
  }
  return {
    ...validation,
    state: failures.length > 0 ? 'failed' : validation.state,
    verified: failures.length > 0 ? false : !!validation.verified,
    integrity: { passed: failures.length === 0, failures },
  };
}

function protectMissionData(value = {}) {
  const data = encryptSecrets(value);
  if (data.input?.evidence && !isEncrypted(data.input.evidence)) data.input.evidence = encrypt(data.input.evidence);
  if (data.input?.app_url && !isEncrypted(data.input.app_url)) data.input.app_url = encrypt(data.input.app_url);
  if (data.investigation?.availability?.excerpt && !isEncrypted(data.investigation.availability.excerpt)) {
    data.investigation.availability.excerpt = encrypt(data.investigation.availability.excerpt);
  }
  if (Array.isArray(data.proposal?.files)) {
    data.proposal.files = data.proposal.files.map(file => ({
      ...file,
      content: file.content && !isEncrypted(file.content) ? encrypt(file.content) : file.content,
    }));
  }
  return data;
}

function revealMissionData(value = {}) {
  const data = decryptSecrets(value);
  if (isEncrypted(data.input?.evidence)) data.input.evidence = decrypt(data.input.evidence);
  if (isEncrypted(data.input?.app_url)) data.input.app_url = decrypt(data.input.app_url);
  if (isEncrypted(data.investigation?.availability?.excerpt)) {
    data.investigation.availability.excerpt = decrypt(data.investigation.availability.excerpt);
  }
  if (Array.isArray(data.proposal?.files)) {
    data.proposal.files = data.proposal.files.map(file => ({
      ...file,
      content: isEncrypted(file.content) ? decrypt(file.content) : file.content,
    }));
  }
  return data;
}

function publicMission(row) {
  return row ? { ...row, data: revealMissionData(row.data || {}) } : null;
}

async function missionOrFail(req, res, requiredRole = null) {
  if (!(await memberOrFail(req, res, req.params.id, requiredRole))) return null;
  const mission = await getProductMission(req.params.missionId, req.params.id);
  if (!mission) {
    res.status(404).json({ error: 'Mission not found' });
    return null;
  }
  return publicMission(mission);
}

function sendError(res, error, fallback = 'Mission action failed') {
  const status = Number(error?.status) || 500;
  return res.status(status).json({
    error: error?.message || fallback,
    code: error?.code,
    field: error?.field,
  });
}

export function buildMissionWorkspaceRouter({
  investigate = investigateMission,
  createPullRequest = createMissionPullRequest,
  readValidation = getMissionPullRequestValidation,
  verifyRepository = verifyRepositoryAccess,
  providerForRequest = getProviderForRequest,
} = {}) {
  const router = express.Router();
  router.use(requireAuth);

  router.get('/:id/missions/config', async (req, res) => {
    const membership = await memberOrFail(req, res, req.params.id);
    if (!membership) return;
    try {
      const github = await githubOptionsForWorkspace(req.params.id);
      const { provider, source } = await providerForRequest(req.user.id);
      res.json({
        github: publicGithubConfig(github, { includeTokenPreview: membership.role === 'admin' }),
        ai: { configured: provider?.name !== 'local', provider: provider?.name || 'unknown', source },
        guarantees: { creates_draft_pr: true, merges: false, deploys: false },
      });
    } catch (error) {
      sendError(res, error, 'Could not read mission configuration');
    }
  });

  router.put('/:id/missions/config/github', async (req, res) => {
    if (!(await memberOrFail(req, res, req.params.id, 'admin'))) return;
    try {
      const existing = await getGithubConfig(req.params.id);
      const suppliedToken = cleanText(req.body?.token, 1_000);
      let token = suppliedToken;
      if (!token && existing?.token_enc) token = decrypt(existing.token_enc);
      if (token.length < 20) {
        return res.status(400).json({ error: 'A GitHub token is required', field: 'token' });
      }
      const repository = validateRepository(
        cleanText(req.body?.repository, 200) || existing?.default_repository || process.env.GITHUB_REPO || ''
      );
      if (!repository) return res.status(400).json({ error: 'repository is required', field: 'repository' });
      const verification = await verifyRepository({ repository }, { token, repo: repository });
      const stored = await upsertGithubConfig({
        workspace_id: req.params.id,
        token_enc: encrypt(token),
        default_repository: verification.repository || repository,
        created_by: req.user.id,
      });
      await appendAudit({
        user_id: req.user.id,
        workspace_id: req.params.id,
        action: 'mission.github.connect',
        target_type: 'github_repository',
        target_id: verification.repository || repository,
        detail: { repository: verification.repository || repository, private: !!verification.private },
        ip: req.ip,
      });
      res.json({
        github: publicGithubConfig(
          { token, repo: stored.default_repository, source: 'workspace', stored },
          { includeTokenPreview: true },
        ),
        verification,
      });
    } catch (error) {
      sendError(res, error, 'Could not connect GitHub');
    }
  });

  router.delete('/:id/missions/config/github', async (req, res) => {
    if (!(await memberOrFail(req, res, req.params.id, 'admin'))) return;
    await deleteGithubConfig(req.params.id);
    await appendAudit({
      user_id: req.user.id,
      workspace_id: req.params.id,
      action: 'mission.github.disconnect',
      target_type: 'github_repository',
      target_id: req.params.id,
      ip: req.ip,
    });
    res.json({ ok: true });
  });

  router.get('/:id/missions', async (req, res) => {
    if (!(await memberOrFail(req, res, req.params.id))) return;
    const rows = await listProductMissions(req.params.id, { limit: req.query.limit });
    res.json({ missions: rows.map(publicMission) });
  });

  router.post('/:id/missions', async (req, res) => {
    if (!(await memberOrFail(req, res, req.params.id, 'member'))) return;
    try {
      const github = await githubOptionsForWorkspace(req.params.id);
      const input = validateMissionInput(req.body || {}, github.repo);
      const mission = await createProductMission({
        workspace_id: req.params.id,
        created_by: req.user.id,
        title: input.title,
        status: 'draft',
        data: protectMissionData({ input, investigation: null, proposal: null, pull_request: null, validation: null }),
      });
      await appendMissionEvent({
        mission_id: mission.id,
        workspace_id: req.params.id,
        actor_id: req.user.id,
        event_type: 'mission.captured',
        detail: { source_type: input.source_type, repository: input.repository || null, has_app_url: !!input.app_url },
      });
      await appendAudit({
        user_id: req.user.id,
        workspace_id: req.params.id,
        action: 'mission.create',
        target_type: 'product_mission',
        target_id: mission.id,
        detail: { source_type: input.source_type, repository: input.repository || null },
        ip: req.ip,
      });
      const events = await listMissionEvents(mission.id, req.params.id);
      res.status(201).json({ mission: publicMission(mission), events });
    } catch (error) {
      sendError(res, error, 'Could not create mission');
    }
  });

  router.get('/:id/missions/:missionId', async (req, res) => {
    const mission = await missionOrFail(req, res);
    if (!mission) return;
    const events = await listMissionEvents(mission.id, req.params.id);
    res.json({ mission, events });
  });

  router.put('/:id/missions/:missionId', async (req, res) => {
    const mission = await missionOrFail(req, res, 'member');
    if (!mission) return;
    if (mission.data?.pull_request) return res.status(409).json({ error: 'A mission with a pull request cannot be rewritten' });
    if (!['draft', 'needs_input', 'failed', 'proposed'].includes(mission.status)) {
      return res.status(409).json({ error: `Mission cannot be edited from ${mission.status}` });
    }
    try {
      const expectedUpdatedAt = cleanText(req.body?.expected_updated_at, 100);
      if (expectedUpdatedAt && new Date(expectedUpdatedAt).getTime() !== new Date(mission.updated_at).getTime()) {
        return res.status(409).json({ error: 'This mission changed in another tab. Reload before editing.', code: 'mission_changed' });
      }
      const input = validateMissionInput({ ...mission.data.input, ...req.body, title: req.body?.title ?? mission.title });
      const data = {
        ...mission.data,
        input,
        investigation: null,
        proposal: null,
        validation: null,
        last_error: null,
      };
      const updated = await transitionProductMission(mission.id, req.params.id, {
        statuses: [mission.status],
        updated_at: mission.updated_at,
      }, {
        title: input.title,
        status: 'draft',
        data: protectMissionData(data),
        proposal_hash: null,
      });
      if (!updated) return res.status(409).json({ error: 'This mission changed in another tab. Reload and try again.', code: 'mission_changed' });
      await appendMissionEvent({
        mission_id: mission.id,
        workspace_id: req.params.id,
        actor_id: req.user.id,
        event_type: 'mission.updated',
        detail: { repository: input.repository || null, has_app_url: !!input.app_url },
      });
      res.json({ mission: publicMission(updated), events: await listMissionEvents(mission.id, req.params.id) });
    } catch (error) {
      sendError(res, error, 'Could not update mission');
    }
  });

  router.post('/:id/missions/:missionId/investigate', async (req, res) => {
    const mission = await missionOrFail(req, res, 'member');
    if (!mission) return;
    const investigationStale = mission.status === 'investigating'
      && Date.now() - new Date(mission.updated_at).getTime() > 10 * 60 * 1000;
    if (!['draft', 'needs_input', 'failed', 'proposed'].includes(mission.status) && !investigationStale) {
      return res.status(409).json({ error: `Mission cannot be investigated from ${mission.status}` });
    }
    if (!mission.data?.input?.repository) return res.status(400).json({ error: 'Connect a repository before investigating', field: 'repository' });

    const claimedRow = await transitionProductMission(mission.id, req.params.id, {
      statuses: [mission.status],
      updated_at: mission.updated_at,
    }, {
      status: 'investigating',
      data: protectMissionData({
        ...mission.data,
        investigation: null,
        proposal: null,
        pull_request: null,
        validation: null,
        last_error: null,
      }),
      proposal_hash: null,
    });
    if (!claimedRow) return res.status(409).json({ error: 'Investigation already started in another tab', code: 'mission_changed' });
    const claimedMission = publicMission(claimedRow);
    await appendMissionEvent({
      mission_id: mission.id,
      workspace_id: req.params.id,
      actor_id: req.user.id,
      event_type: 'investigation.started',
      detail: { repository: claimedMission.data.input.repository },
    });

    try {
      const { provider, source } = await providerForRequest(req.user.id);
      const githubOptions = await githubOptionsForWorkspace(req.params.id);
      const result = await investigate(claimedMission, { provider, githubOptions });
      if (!['needs_input', 'proposed'].includes(result.outcome)) {
        throw Object.assign(new Error('Investigation returned an unsupported outcome'), { status: 502, code: 'model_invalid_response' });
      }
      const data = protectMissionData({
        ...claimedMission.data,
        investigation: { ...result.investigation, provider_source: source },
        proposal: result.proposal,
        pull_request: null,
        validation: null,
        last_error: null,
      });
      const updated = await transitionProductMission(mission.id, req.params.id, {
        statuses: ['investigating'],
        updated_at: claimedMission.updated_at,
      }, {
        status: result.outcome,
        data,
        proposal_hash: result.proposal?.proposal_hash || null,
      });
      if (!updated) return res.status(409).json({ error: 'Mission changed while investigation was running', code: 'mission_changed' });
      await appendMissionEvent({
        mission_id: mission.id,
        workspace_id: req.params.id,
        actor_id: req.user.id,
        event_type: result.outcome === 'proposed' ? 'proposal.prepared' : 'investigation.needs_input',
        detail: result.outcome === 'proposed'
          ? { proposal_hash: result.proposal.proposal_hash, file_count: result.proposal.files.length, base_sha: result.proposal.base_sha }
          : { question_count: result.investigation?.questions?.length || 0 },
      });
      await appendAudit({
        user_id: req.user.id,
        workspace_id: req.params.id,
        action: result.outcome === 'proposed' ? 'mission.proposal.prepare' : 'mission.investigation.needs_input',
        target_type: 'product_mission',
        target_id: mission.id,
        detail: result.outcome === 'proposed'
          ? { proposal_hash: result.proposal.proposal_hash, file_count: result.proposal.files.length }
          : { question_count: result.investigation?.questions?.length || 0 },
        ip: req.ip,
      });
      res.json({ mission: publicMission(updated), events: await listMissionEvents(mission.id, req.params.id) });
    } catch (error) {
      const status = Number(error?.status) || 500;
      const message = error?.message || 'Investigation failed';
      const failedData = protectMissionData({
        ...claimedMission.data,
        last_error: { message, code: error?.code || 'investigation_failed', at: new Date().toISOString() },
      });
      await transitionProductMission(mission.id, req.params.id, {
        statuses: ['investigating'],
        updated_at: claimedMission.updated_at,
      }, { status: 'failed', data: failedData, proposal_hash: null });
      await appendMissionEvent({
        mission_id: mission.id,
        workspace_id: req.params.id,
        actor_id: req.user.id,
        event_type: 'investigation.failed',
        detail: { code: error?.code || 'investigation_failed', message: message.slice(0, 500) },
      });
      res.status(status).json({ error: message, code: error?.code || 'investigation_failed' });
    }
  });

  router.post('/:id/missions/:missionId/approve', async (req, res) => {
    const mission = await missionOrFail(req, res, 'member');
    if (!mission) return;
    const approvalStale = mission.status === 'approving'
      && Date.now() - new Date(mission.updated_at).getTime() > 10 * 60 * 1000;
    if ((mission.status !== 'proposed' && !approvalStale) || !mission.data?.proposal) {
      return res.status(409).json({ error: 'Mission has no proposal ready for approval' });
    }
    const suppliedHash = cleanText(req.body?.proposal_hash, 128);
    const currentHash = hashMissionProposal(mission.data.proposal);
    if (!suppliedHash || suppliedHash !== mission.proposal_hash || currentHash !== mission.proposal_hash) {
      return res.status(409).json({ error: 'The proposal changed. Reload and review the current proposal before approving.', code: 'proposal_changed' });
    }
    const claimedRow = await transitionProductMission(mission.id, req.params.id, {
      statuses: [mission.status],
      updated_at: mission.updated_at,
    }, {
      status: 'approving',
      data: protectMissionData({ ...mission.data, last_error: null }),
    });
    if (!claimedRow) return res.status(409).json({ error: 'Approval already started in another tab', code: 'mission_changed' });
    const claimedMission = publicMission(claimedRow);
    try {
      const githubOptions = await githubOptionsForWorkspace(req.params.id);
      const pullRequest = await createPullRequest({
        missionId: claimedMission.id,
        title: claimedMission.title,
        proposal: claimedMission.data.proposal,
        proposalHash: currentHash,
      }, githubOptions);
      const data = protectMissionData({
        ...claimedMission.data,
        approval: { approved_by: req.user.id, proposal_hash: currentHash, approved_at: new Date().toISOString() },
        pull_request: pullRequest,
        validation: null,
        last_error: null,
      });
      const updated = await transitionProductMission(mission.id, req.params.id, {
        statuses: ['approving'],
        updated_at: claimedMission.updated_at,
      }, { status: 'awaiting_validation', data });
      if (!updated) return res.status(409).json({ error: 'Mission changed while the pull request was being created', code: 'mission_changed' });
      await appendMissionEvent({
        mission_id: mission.id,
        workspace_id: req.params.id,
        actor_id: req.user.id,
        event_type: 'pull_request.opened',
        detail: { proposal_hash: currentHash, repository: pullRequest.repository, number: pullRequest.number, draft: true },
      });
      await appendAudit({
        user_id: req.user.id,
        workspace_id: req.params.id,
        action: 'mission.pull_request.open',
        target_type: 'product_mission',
        target_id: mission.id,
        detail: { proposal_hash: currentHash, repository: pullRequest.repository, pull_request: pullRequest.number, draft: true },
        ip: req.ip,
      });
      res.json({ mission: publicMission(updated), events: await listMissionEvents(mission.id, req.params.id) });
    } catch (error) {
      await transitionProductMission(mission.id, req.params.id, {
        statuses: ['approving'],
        updated_at: claimedMission.updated_at,
      }, {
        status: 'proposed',
        data: protectMissionData({
          ...claimedMission.data,
          last_error: { message: error?.message || 'Could not create the draft pull request', code: error?.code || 'github_error', at: new Date().toISOString() },
        }),
      });
      sendError(res, error, 'Could not create the draft pull request');
    }
  });

  router.post('/:id/missions/:missionId/validation', async (req, res) => {
    const mission = await missionOrFail(req, res, 'member');
    if (!mission) return;
    const pullRequest = mission.data?.pull_request;
    if (!pullRequest?.number || !pullRequest?.repository) return res.status(409).json({ error: 'Mission has no pull request to validate' });
    try {
      const githubOptions = await githubOptionsForWorkspace(req.params.id);
      const rawValidation = await readValidation({ repository: pullRequest.repository, prNumber: pullRequest.number }, githubOptions);
      const validation = bindValidationToApproval(rawValidation, pullRequest, mission.data?.proposal);
      const status = validation.state === 'passed'
        ? 'ready_for_review'
        : validation.state === 'failed'
          ? 'validation_failed'
          : 'awaiting_validation';
      if (!MISSION_STATUSES.has(status)) throw new Error('Invalid validation status');
      const updated = await transitionProductMission(mission.id, req.params.id, {
        statuses: [mission.status],
        updated_at: mission.updated_at,
      }, {
        status,
        data: protectMissionData({ ...mission.data, validation, last_error: null }),
      });
      if (!updated) return res.status(409).json({ error: 'Validation changed in another tab. Reload and try again.', code: 'mission_changed' });
      if (mission.data?.validation?.state !== validation.state) {
        await appendMissionEvent({
          mission_id: mission.id,
          workspace_id: req.params.id,
          actor_id: req.user.id,
          event_type: `validation.${validation.state}`,
          detail: { check_count: validation.checks?.length || 0, head_sha: validation.head_sha },
        });
      }
      await appendAudit({
        user_id: req.user.id,
        workspace_id: req.params.id,
        action: 'mission.validation.sync',
        target_type: 'product_mission',
        target_id: mission.id,
        detail: { state: validation.state, check_count: validation.checks?.length || 0 },
        ip: req.ip,
      });
      res.json({ mission: publicMission(updated), events: await listMissionEvents(mission.id, req.params.id) });
    } catch (error) {
      sendError(res, error, 'Could not read pull request checks');
    }
  });

  router.post('/:id/missions/:missionId/reject', async (req, res) => {
    const mission = await missionOrFail(req, res, 'member');
    if (!mission) return;
    if (mission.data?.pull_request) return res.status(409).json({ error: 'Close the pull request in GitHub before rejecting this mission' });
    if (!['draft', 'needs_input', 'failed', 'proposed'].includes(mission.status)) {
      return res.status(409).json({ error: `Mission cannot be rejected from ${mission.status}` });
    }
    const reason = cleanText(req.body?.reason, 1_000);
    const updated = await transitionProductMission(mission.id, req.params.id, {
      statuses: [mission.status],
      updated_at: mission.updated_at,
    }, {
      status: 'rejected',
      data: protectMissionData({ ...mission.data, rejection: { reason, rejected_by: req.user.id, rejected_at: new Date().toISOString() } }),
    });
    if (!updated) return res.status(409).json({ error: 'This mission changed in another tab. Reload and try again.', code: 'mission_changed' });
    await appendMissionEvent({
      mission_id: mission.id,
      workspace_id: req.params.id,
      actor_id: req.user.id,
      event_type: 'mission.rejected',
      detail: { reason: reason.slice(0, 500) },
    });
    await appendAudit({
      user_id: req.user.id,
      workspace_id: req.params.id,
      action: 'mission.reject',
      target_type: 'product_mission',
      target_id: mission.id,
      detail: { reason: reason.slice(0, 500) },
      ip: req.ip,
    });
    res.json({ mission: publicMission(updated), events: await listMissionEvents(mission.id, req.params.id) });
  });

  return router;
}
