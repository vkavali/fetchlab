import crypto from 'crypto';
import express from 'express';
import * as db from './db.js';
import { requireAuth } from './auth.js';
import { appendAudit } from './db.js';
import { decryptSecrets, encryptSecrets } from './workspaces.js';
import { apiLimiter, gateCredentialLimiter } from './rateLimit.js';
import {
  buildAuthorityDiff,
  canonicalize,
  evaluatePolicy,
  validateAction,
  validatePolicy,
} from '../shared/authorityEngine.js';

const ROLE_ORDER = { viewer: 0, member: 1, admin: 2 };
const SENSITIVE_KEY_RE = /password|secret|token|api[_-]?key|client[_-]?secret|access[_-]?token|refresh[_-]?token|authorization|cookie|credential|private[_-]?key/i;
const DEFAULT_TOKEN_SCOPES = ['authority:check', 'authority:read', 'authority:consume'];
const MAX_REPLAY_EVENTS = 10000;

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function policyFingerprint(policy) {
  return sha256(canonicalize(policy));
}

export function actionFingerprint(action) {
  return sha256(canonicalize(action));
}

async function memberOrFail(req, res, workspaceId, requiredRole = null) {
  const membership = await db.getWorkspaceMember(workspaceId, req.user.id);
  if (!membership) {
    res.status(403).json({ error: 'Not a member of this workspace' });
    return null;
  }
  if (requiredRole && (ROLE_ORDER[membership.role] ?? -1) < ROLE_ORDER[requiredRole]) {
    res.status(403).json({ error: `Requires ${requiredRole} role` });
    return null;
  }
  return membership;
}

function redactSecrets(value) {
  if (Array.isArray(value)) return value.map(redactSecrets);
  if (!value || typeof value !== 'object') return value;
  const output = {};
  for (const [key, nested] of Object.entries(value)) {
    output[key] = SENSITIVE_KEY_RE.test(key) ? '[REDACTED]' : redactSecrets(nested);
  }
  return output;
}

function eventResponse(event, { reused = false, includeAction = false } = {}) {
  const response = {
    event_id: event.id,
    study_id: event.study_id,
    decision: event.decision,
    execute: event.mode === 'shadow' || event.decision === 'allow' || Boolean(event.consumed_at),
    mode: event.mode,
    reason: event.reason,
    matched_rule_id: event.matched_rule_id,
    policy_revision: Number(event.policy_revision),
    policy_fingerprint: event.policy_fingerprint,
    action_hash: event.action_hash,
    review_status: event.review_status,
    approval_expires_at: event.approval_expires_at,
    consumed_at: event.consumed_at,
    created_at: event.created_at,
    reused,
  };
  if (includeAction) {
    response.action = redactSecrets(decryptSecrets(event.action_data));
    response.agent_id = event.agent_id;
    response.session_id = event.session_id;
  }
  return response;
}

function idempotencyKey(req) {
  const value = req.get('Idempotency-Key');
  if (!value || value.length > 200 || /[\r\n]/.test(value)) return null;
  return value;
}

async function requireGateToken(req, res, next) {
  const authorization = req.get('Authorization') || '';
  const raw = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!raw.startsWith('flk_') || raw.length < 40) {
    return res.status(401).json({ error: 'Invalid authority credential' });
  }
  const token = await db.findApiTokenByHash(sha256(raw));
  const expired = token?.expires_at && new Date(token.expires_at).getTime() <= Date.now();
  if (!token || !token.workspace_id || token.revoked_at || expired) {
    return res.status(401).json({ error: 'Invalid authority credential' });
  }
  req.gateToken = token;
  return next();
}

async function touchGateToken(req, _res, next) {
  await db.touchApiToken(req.gateToken.id);
  return next();
}

function requireScope(scope) {
  return (req, res, next) => {
    const scopes = Array.isArray(req.gateToken?.scopes) ? req.gateToken.scopes : [];
    if (!scopes.includes(scope)) return res.status(403).json({ error: `Missing ${scope} scope` });
    return next();
  };
}

async function loadAuthorityState(workspaceId, studyId) {
  const study = await db.getAutonomyStudy(studyId, workspaceId);
  if (!study) return null;
  const published = study.published_revision > 0
    ? await db.getAuthorityPolicyRevision(studyId, study.published_revision)
    : null;
  const totalEvents = await db.countAuthorityEvents(workspaceId, studyId);
  const storedEvents = await db.listAuthorityEvents(workspaceId, studyId, MAX_REPLAY_EVENTS);
  const replayEvents = storedEvents.map((event) => ({
    id: event.id,
    action_hash: event.action_hash,
    action: decryptSecrets(event.action_data),
  }));
  const draftFingerprint = policyFingerprint(study.draft_policy);
  const diff = buildAuthorityDiff(replayEvents, published?.policy || null, study.draft_policy);
  const reviews = await db.listAuthorityChangeReviews(workspaceId, studyId, draftFingerprint);
  const reviewsByEvent = new Map(reviews.map((review) => [review.event_id, review]));
  const rows = diff.rows.map((row) => ({
    ...row,
    review: reviewsByEvent.get(row.eventId) || null,
  }));
  const expansions = rows.filter((row) => row.change === 'expansion');
  const unresolvedExpansions = expansions.filter((row) => row.review?.verdict !== 'approved');
  return {
    study,
    published,
    draftFingerprint,
    storedEvents,
    diff: {
      rows,
      expansions,
      restrictions: rows.filter((row) => row.change === 'restriction'),
      unchanged: rows.filter((row) => row.change === 'unchanged'),
      unresolvedExpansions,
      evidenceComplete: totalEvents <= storedEvents.length,
      totalEvents,
    },
  };
}

function publicAuthorityState(state) {
  return {
    study: {
      id: state.study.id,
      name: state.study.name,
      draft_policy: state.study.draft_policy,
      published_revision: state.study.published_revision,
      updated_at: state.study.updated_at,
    },
    draft_fingerprint: state.draftFingerprint,
    published: state.published,
    events: state.storedEvents.map((event) => eventResponse(event, { includeAction: true })),
    diff: {
      rows: state.diff.rows,
      expansion_count: state.diff.expansions.length,
      restriction_count: state.diff.restrictions.length,
      unchanged_count: state.diff.unchanged.length,
      unresolved_expansion_count: state.diff.unresolvedExpansions.length,
      evidence_complete: state.diff.evidenceComplete,
      total_events: state.diff.totalEvents,
    },
  };
}

export function buildAuthorityWorkspaceRouter() {
  const router = express.Router();
  router.use(requireAuth);

  router.get('/:id/authority-tokens', async (req, res) => {
    if (!(await memberOrFail(req, res, req.params.id, 'admin'))) return;
    const credentials = await db.listApiTokens(req.params.id);
    res.json({ credentials });
  });

  router.post('/:id/authority-tokens', async (req, res) => {
    if (!(await memberOrFail(req, res, req.params.id, 'admin'))) return;
    const { name, expires_at = null } = req.body || {};
    if (typeof name !== 'string' || !name.trim() || name.trim().length > 100) {
      return res.status(400).json({ error: 'Credential name is required and must be at most 100 characters.' });
    }
    if (expires_at && (Number.isNaN(Date.parse(expires_at)) || new Date(expires_at).getTime() <= Date.now())) {
      return res.status(400).json({ error: 'Expiry must be a future ISO date.' });
    }
    const raw = `flk_${crypto.randomBytes(32).toString('base64url')}`;
    const credential = await db.createApiToken({
      user_id: req.user.id,
      workspace_id: req.params.id,
      name: name.trim(),
      token_hash: sha256(raw),
      token_prefix: `${raw.slice(0, 12)}...`,
      scopes: DEFAULT_TOKEN_SCOPES,
      expires_at: expires_at || null,
    });
    await appendAudit({
      user_id: req.user.id,
      workspace_id: req.params.id,
      action: 'authority.credential.create',
      target_type: 'api_token',
      target_id: credential.id,
      detail: { name: credential.name, scopes: credential.scopes, expires_at: credential.expires_at },
      ip: req.ip,
    });
    const { token_hash: _tokenHash, ...safeCredential } = credential;
    return res.status(201).json({ credential: safeCredential, token: raw });
  });

  router.delete('/:id/authority-tokens/:tokenId', async (req, res) => {
    if (!(await memberOrFail(req, res, req.params.id, 'admin'))) return;
    const revoked = await db.revokeApiToken(req.params.tokenId, req.params.id);
    if (!revoked) return res.status(404).json({ error: 'Credential not found' });
    await appendAudit({
      user_id: req.user.id,
      workspace_id: req.params.id,
      action: 'authority.credential.revoke',
      target_type: 'api_token',
      target_id: req.params.tokenId,
      ip: req.ip,
    });
    return res.json({ ok: true });
  });

  router.get('/:id/autonomy-studies/:studyId/authority', async (req, res) => {
    if (!(await memberOrFail(req, res, req.params.id))) return;
    const state = await loadAuthorityState(req.params.id, req.params.studyId);
    if (!state) return res.status(404).json({ error: 'Study not found' });
    return res.json(publicAuthorityState(state));
  });

  router.put('/:id/autonomy-studies/:studyId/authority/draft', async (req, res) => {
    if (!(await memberOrFail(req, res, req.params.id, 'member'))) return;
    const { policy } = req.body || {};
    const validation = validatePolicy(policy);
    if (!validation.valid) return res.status(400).json({ error: 'Invalid policy', fields: validation.errors });
    const study = await db.updateAutonomyDraftPolicy(req.params.studyId, req.params.id, policy);
    if (!study) return res.status(404).json({ error: 'Study not found' });
    const fingerprint = policyFingerprint(policy);
    await appendAudit({
      user_id: req.user.id,
      workspace_id: req.params.id,
      action: 'authority.draft.update',
      target_type: 'autonomy_study',
      target_id: req.params.studyId,
      detail: { fingerprint, rule_count: policy.rules.length, mode: policy.mode },
      ip: req.ip,
    });
    return res.json({ draft_policy: policy, draft_fingerprint: fingerprint, updated_at: study.updated_at });
  });

  router.post('/:id/autonomy-studies/:studyId/authority/expansions/:eventId/review', async (req, res) => {
    if (!(await memberOrFail(req, res, req.params.id, 'member'))) return;
    const { draft_fingerprint, verdict, note = null } = req.body || {};
    if (!['approved', 'rejected'].includes(verdict)) return res.status(400).json({ error: 'Verdict must be approved or rejected.' });
    if (note != null && (typeof note !== 'string' || note.length > 2000)) return res.status(400).json({ error: 'Note must be at most 2000 characters.' });
    const state = await loadAuthorityState(req.params.id, req.params.studyId);
    if (!state) return res.status(404).json({ error: 'Study not found' });
    if (draft_fingerprint !== state.draftFingerprint) {
      return res.status(409).json({ error: 'Draft changed. Refresh the authority diff before reviewing.' });
    }
    const expansion = state.diff.expansions.find((row) => row.eventId === req.params.eventId);
    if (!expansion) return res.status(409).json({ error: 'This event is not an authority expansion in the current draft.' });
    const review = await db.upsertAuthorityChangeReview({
      workspace_id: req.params.id,
      study_id: req.params.studyId,
      event_id: req.params.eventId,
      draft_fingerprint,
      verdict,
      note,
      reviewed_by: req.user.id,
    });
    await appendAudit({
      user_id: req.user.id,
      workspace_id: req.params.id,
      action: 'authority.expansion.review',
      target_type: 'authority_event',
      target_id: req.params.eventId,
      detail: { draft_fingerprint, verdict },
      ip: req.ip,
    });
    return res.json({ review });
  });

  router.post('/:id/autonomy-studies/:studyId/authority/publish', async (req, res) => {
    if (!(await memberOrFail(req, res, req.params.id, 'admin'))) return;
    const expectedRevision = req.body?.expected_revision;
    if (!Number.isInteger(expectedRevision) || expectedRevision < 0) {
      return res.status(400).json({ error: 'expected_revision must be a non-negative integer.' });
    }
    const state = await loadAuthorityState(req.params.id, req.params.studyId);
    if (!state) return res.status(404).json({ error: 'Study not found' });
    if (expectedRevision !== Number(state.study.published_revision)) {
      return res.status(409).json({
        error: 'A newer policy revision was published. Refresh before publishing again.',
        current_revision: Number(state.study.published_revision),
      });
    }
    const validation = validatePolicy(state.study.draft_policy, { requireEnabledRule: true });
    if (!validation.valid) return res.status(400).json({ error: 'Policy cannot be published', fields: validation.errors });
    if (!state.diff.evidenceComplete) {
      return res.status(409).json({
        error: `Replay exceeds ${MAX_REPLAY_EVENTS} events. Narrow or archive evidence before publishing.`,
        code: 'authority_evidence_incomplete',
      });
    }
    if (state.published?.fingerprint === state.draftFingerprint) {
      return res.json({ unchanged: true, revision: state.published });
    }
    if (state.diff.unresolvedExpansions.length > 0) {
      return res.status(409).json({
        error: 'Review every authority expansion before publishing.',
        code: 'authority_expansions_unreviewed',
        expansions: state.diff.unresolvedExpansions,
      });
    }
    const result = await db.publishAuthorityPolicy({
      workspace_id: req.params.id,
      study_id: req.params.studyId,
      expected_revision: expectedRevision,
      fingerprint: state.draftFingerprint,
      policy: state.study.draft_policy,
      published_by: req.user.id,
    });
    if (result.status === 'not_found') return res.status(404).json({ error: 'Study not found' });
    if (result.status === 'conflict') {
      return res.status(409).json({
        error: 'A newer policy revision was published. Refresh before publishing again.',
        current_revision: result.current_revision,
      });
    }
    await appendAudit({
      user_id: req.user.id,
      workspace_id: req.params.id,
      action: 'authority.policy.publish',
      target_type: 'autonomy_study',
      target_id: req.params.studyId,
      detail: {
        revision: result.revision.revision,
        fingerprint: result.revision.fingerprint,
        prior_fingerprint: result.revision.prior_fingerprint,
        expansion_count: state.diff.expansions.length,
        restriction_count: state.diff.restrictions.length,
      },
      ip: req.ip,
    });
    return res.status(201).json({ revision: result.revision });
  });

  router.post('/:id/autonomy-studies/:studyId/authority/events/:eventId/review', async (req, res) => {
    if (!(await memberOrFail(req, res, req.params.id, 'member'))) return;
    const { verdict, note = null, expires_in_seconds = 900 } = req.body || {};
    if (!['approved', 'denied'].includes(verdict)) return res.status(400).json({ error: 'Verdict must be approved or denied.' });
    if (note != null && (typeof note !== 'string' || note.length > 2000)) return res.status(400).json({ error: 'Note must be at most 2000 characters.' });
    if (verdict === 'approved' && (!Number.isInteger(expires_in_seconds) || expires_in_seconds < 60 || expires_in_seconds > 86400)) {
      return res.status(400).json({ error: 'Approval expiry must be between 60 and 86400 seconds.' });
    }
    const study = await db.getAutonomyStudy(req.params.studyId, req.params.id);
    const event = await db.getAuthorityEvent(req.params.eventId, req.params.id);
    if (!study || !event || event.study_id !== req.params.studyId) return res.status(404).json({ error: 'Approval request not found' });
    if (verdict === 'approved' && Number(study.published_revision) !== Number(event.policy_revision)) {
      return res.status(409).json({ error: 'The policy changed. Submit the action again under the current revision.' });
    }
    const expiresAt = verdict === 'approved'
      ? new Date(Date.now() + expires_in_seconds * 1000).toISOString()
      : null;
    const reviewed = await db.reviewAuthorityEvent({
      id: event.id,
      workspace_id: req.params.id,
      reviewed_by: req.user.id,
      verdict,
      note,
      expires_at: expiresAt,
    });
    if (!reviewed) return res.status(409).json({ error: 'Approval request is no longer pending.' });
    await appendAudit({
      user_id: req.user.id,
      workspace_id: req.params.id,
      action: 'authority.action.review',
      target_type: 'authority_event',
      target_id: event.id,
      detail: { verdict, policy_revision: event.policy_revision, expires_at: expiresAt },
      ip: req.ip,
    });
    return res.json({ event: eventResponse(reviewed, { includeAction: true }) });
  });

  return router;
}

export function buildAuthorityRuntimeRouter() {
  const router = express.Router();
  router.use(gateCredentialLimiter);
  router.use(requireGateToken);
  router.use(apiLimiter);
  router.use(touchGateToken);

  router.post('/check', requireScope('authority:check'), async (req, res) => {
    const { study_id: studyId, action } = req.body || {};
    if (typeof studyId !== 'string' || !studyId) return res.status(400).json({ error: 'study_id is required.' });
    const actionValidation = validateAction(action);
    if (!actionValidation.valid) return res.status(400).json({ error: 'Invalid action', fields: actionValidation.errors });
    const requestKey = idempotencyKey(req);
    if (!requestKey) return res.status(400).json({ error: 'A valid Idempotency-Key header is required.' });
    const actionHash = actionFingerprint(action);
    const existing = await db.findAuthorityEventByIdempotency(req.gateToken.workspace_id, requestKey);
    if (existing) {
      if (existing.study_id !== studyId || existing.action_hash !== actionHash) {
        return res.status(409).json({ error: 'Idempotency key was already used for a different action.' });
      }
      return res.json(eventResponse(existing, { reused: true }));
    }

    const study = await db.getAutonomyStudy(studyId, req.gateToken.workspace_id);
    if (!study) return res.status(404).json({ error: 'Study not found' });
    if (!study.published_revision) return res.status(409).json({ error: 'No policy has been published for this study.' });
    const published = await db.getAuthorityPolicyRevision(study.id, study.published_revision);
    if (!published) return res.status(409).json({ error: 'Published policy revision is unavailable.' });
    const evaluation = evaluatePolicy(published.policy, action);
    const reviewStatus = published.policy.mode === 'shadow'
      ? 'shadow'
      : evaluation.decision === 'require_approval' ? 'pending' : 'not_required';

    let event;
    try {
      event = await db.appendAuthorityEvent({
        workspace_id: req.gateToken.workspace_id,
        study_id: study.id,
        agent_id: action.agent_id,
        session_id: action.session_id,
        source: 'runtime',
        idempotency_key: requestKey,
        action_data: encryptSecrets(action),
        action_hash: actionHash,
        decision: evaluation.decision,
        matched_rule_id: evaluation.matchedRuleId,
        mode: published.policy.mode,
        policy_revision: published.revision,
        policy_fingerprint: published.fingerprint,
        reason: evaluation.reason,
        review_status: reviewStatus,
      });
    } catch (error) {
      if (error?.code !== '23505') throw error;
      const raced = await db.findAuthorityEventByIdempotency(req.gateToken.workspace_id, requestKey);
      if (!raced || raced.study_id !== studyId || raced.action_hash !== actionHash) {
        return res.status(409).json({ error: 'Idempotency key was already used for a different action.' });
      }
      return res.json(eventResponse(raced, { reused: true }));
    }
    await appendAudit({
      user_id: req.gateToken.user_id,
      workspace_id: req.gateToken.workspace_id,
      action: 'authority.action.check',
      target_type: 'authority_event',
      target_id: event.id,
      detail: {
        study_id: study.id,
        decision: event.decision,
        mode: event.mode,
        policy_revision: event.policy_revision,
        action_hash: event.action_hash,
      },
      ip: req.ip,
    });
    return res.status(201).json(eventResponse(event));
  });

  router.get('/events/:eventId', requireScope('authority:read'), async (req, res) => {
    const event = await db.getAuthorityEvent(req.params.eventId, req.gateToken.workspace_id);
    if (!event) return res.status(404).json({ error: 'Decision event not found' });
    return res.json(eventResponse(event));
  });

  router.post('/events/:eventId/consume', requireScope('authority:consume'), async (req, res) => {
    const { action } = req.body || {};
    const validation = validateAction(action);
    if (!validation.valid) return res.status(400).json({ error: 'Invalid action', fields: validation.errors });
    const event = await db.getAuthorityEvent(req.params.eventId, req.gateToken.workspace_id);
    if (!event) return res.status(404).json({ error: 'Approval request not found' });
    if (event.action_hash !== actionFingerprint(action)) return res.status(409).json({ error: 'Approval is bound to a different action payload.' });
    if (event.review_status === 'pending') return res.status(409).json({ error: 'Approval is still pending.' });
    if (event.review_status === 'denied') return res.status(403).json({ error: 'Approval was denied.' });
    if (event.consumed_at) return res.status(409).json({ error: 'Approval was already consumed.' });
    if (!event.approval_expires_at || new Date(event.approval_expires_at).getTime() <= Date.now()) {
      return res.status(410).json({ error: 'Approval expired.' });
    }
    const study = await db.getAutonomyStudy(event.study_id, req.gateToken.workspace_id);
    if (!study || Number(study.published_revision) !== Number(event.policy_revision)) {
      return res.status(409).json({ error: 'The policy changed. Submit the action again under the current revision.' });
    }
    const consumed = await db.consumeAuthorityApproval({
      id: event.id,
      workspace_id: req.gateToken.workspace_id,
      action_hash: event.action_hash,
    });
    if (!consumed) return res.status(409).json({ error: 'Approval could not be consumed.' });
    await appendAudit({
      user_id: req.gateToken.user_id,
      workspace_id: req.gateToken.workspace_id,
      action: 'authority.action.consume',
      target_type: 'authority_event',
      target_id: event.id,
      detail: { policy_revision: event.policy_revision, action_hash: event.action_hash },
      ip: req.ip,
    });
    return res.json(eventResponse(consumed));
  });

  return router;
}
