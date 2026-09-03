import express from 'express';
import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  _resetForTests,
  getGithubConfig,
  getProductMission,
  initDb,
} from '../server/db.js';
import { resetKeyCache } from '../server/encryption.js';
import { hashMissionProposal } from '../server/missionEngine.js';
import { buildMissionWorkspaceRouter } from '../server/missions.js';

let app;

beforeAll(async () => {
  process.env.JWT_SECRET = 'missions-test-secret-that-is-long-enough';
  process.env.APP_ENCRYPTION_KEY = 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789';
  process.env.GITHUB_TOKEN = 'test-token';
  process.env.GITHUB_REPO = 'acme/shop';
  resetKeyCache();
  delete process.env.DATABASE_URL;
  delete process.env.FETCHLAB_DATA_FILE;
  await initDb();
  const { buildApp } = await import('../server/app.js');
  app = await buildApp({ skipDbInit: true });
});

beforeEach(() => {
  _resetForTests();
});

async function register(email) {
  const response = await request(app).post('/api/auth/register').send({ email, password: 'password123' });
  const workspaces = await request(app)
    .get('/api/workspaces')
    .set('Authorization', `Bearer ${response.body.token}`);
  return { token: response.body.token, user: response.body.user, workspace: workspaces.body.workspaces[0] };
}

function missionPayload(overrides = {}) {
  return {
    title: 'Checkout total becomes NaN',
    outcome: 'Customers always see a numeric checkout total.',
    evidence: 'Support ticket 184 says checkout shows NaN after applying a discount with no amount.',
    repository: 'acme/shop',
    app_url: 'https://staging.example.com/checkout',
    source_type: 'support',
    ...overrides,
  };
}

function injectedApp(deps) {
  const testApp = express();
  testApp.use(express.json());
  testApp.use('/api/workspaces', buildMissionWorkspaceRouter(deps));
  return testApp;
}

describe('product missions API', () => {
  it('captures encrypted evidence and scopes reads to workspace membership', async () => {
    const owner = await register('mission-owner@test.io');
    const stranger = await register('mission-stranger@test.io');
    const created = await request(app)
      .post(`/api/workspaces/${owner.workspace.id}/missions`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send(missionPayload());

    expect(created.status).toBe(201);
    expect(created.body.mission.status).toBe('draft');
    expect(created.body.mission.data.input.evidence).toContain('Support ticket 184');
    const stored = await getProductMission(created.body.mission.id, owner.workspace.id);
    expect(stored.data.input.evidence).toMatch(/^v1:/);
    expect(stored.data.input.app_url).toMatch(/^v1:/);

    const forbidden = await request(app)
      .get(`/api/workspaces/${owner.workspace.id}/missions/${created.body.mission.id}`)
      .set('Authorization', `Bearer ${stranger.token}`);
    expect(forbidden.status).toBe(403);

    const wrongWorkspace = await request(app)
      .get(`/api/workspaces/${stranger.workspace.id}/missions/${created.body.mission.id}`)
      .set('Authorization', `Bearer ${stranger.token}`);
    expect(wrongWorkspace.status).toBe(404);
  });

  it('rejects incomplete input and viewer writes with field-specific errors', async () => {
    const owner = await register('mission-admin@test.io');
    const viewer = await register('mission-viewer@test.io');
    await request(app)
      .post(`/api/workspaces/${owner.workspace.id}/members`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ email: viewer.user.email, role: 'viewer' });

    const invalid = await request(app)
      .post(`/api/workspaces/${owner.workspace.id}/missions`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send(missionPayload({ evidence: 'too short' }));
    expect(invalid.status).toBe(400);
    expect(invalid.body.field).toBe('evidence');

    const blocked = await request(app)
      .post(`/api/workspaces/${owner.workspace.id}/missions`)
      .set('Authorization', `Bearer ${viewer.token}`)
      .send(missionPayload());
    expect(blocked.status).toBe(403);
  });

  it('verifies and encrypts a workspace GitHub connection before using it', async () => {
    const owner = await register('mission-github-owner@test.io');
    const viewer = await register('mission-github-viewer@test.io');
    await request(app)
      .post(`/api/workspaces/${owner.workspace.id}/members`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ email: viewer.user.email, role: 'viewer' });
    const verifyRepository = vi.fn(async ({ repository }) => ({
      repository,
      default_branch: 'main',
      base_sha: 'base-sha',
      private: true,
      can_push: true,
    }));
    const configApp = injectedApp({
      verifyRepository,
      providerForRequest: async () => ({ provider: { name: 'test' }, source: 'test' }),
    });
    const token = 'github_pat_abcdefghijklmnopqrstuvwxyz123456789';

    const forbidden = await request(configApp)
      .put(`/api/workspaces/${owner.workspace.id}/missions/config/github`)
      .set('Authorization', `Bearer ${viewer.token}`)
      .send({ token, repository: 'acme/private-store' });
    expect(forbidden.status).toBe(403);

    const connected = await request(configApp)
      .put(`/api/workspaces/${owner.workspace.id}/missions/config/github`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ token, repository: 'acme/private-store' });
    expect(connected.status).toBe(200);
    expect(connected.body.github).toMatchObject({
      configured: true,
      default_repository: 'acme/private-store',
      source: 'workspace',
    });
    expect(JSON.stringify(connected.body)).not.toContain(token);
    expect(verifyRepository).toHaveBeenCalledWith(
      { repository: 'acme/private-store' },
      { token, repo: 'acme/private-store' },
    );
    const stored = await getGithubConfig(owner.workspace.id);
    expect(stored.token_enc).toMatch(/^v1:/);
    expect(stored.token_enc).not.toContain(token);

    const config = await request(configApp)
      .get(`/api/workspaces/${owner.workspace.id}/missions/config`)
      .set('Authorization', `Bearer ${owner.token}`);
    expect(config.body.github).toMatchObject({
      configured: true,
      default_repository: 'acme/private-store',
      source: 'workspace',
    });
    expect(JSON.stringify(config.body)).not.toContain(token);

    const viewerConfig = await request(configApp)
      .get(`/api/workspaces/${owner.workspace.id}/missions/config`)
      .set('Authorization', `Bearer ${viewer.token}`);
    expect(viewerConfig.status).toBe(200);
    expect(viewerConfig.body.github).not.toHaveProperty('token_preview');

    const created = await request(configApp)
      .post(`/api/workspaces/${owner.workspace.id}/missions`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send(missionPayload({ repository: '' }));
    expect(created.status).toBe(201);
    expect(created.body.mission.data.input.repository).toBe('acme/private-store');
  });

  it('rejects a stale edit from another tab', async () => {
    const owner = await register('mission-stale-edit@test.io');
    const created = await request(app)
      .post(`/api/workspaces/${owner.workspace.id}/missions`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send(missionPayload());
    const originalVersion = created.body.mission.updated_at;

    const firstEdit = await request(app)
      .put(`/api/workspaces/${owner.workspace.id}/missions/${created.body.mission.id}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send(missionPayload({ title: 'First tab update', expected_updated_at: originalVersion }));
    expect(firstEdit.status).toBe(200);

    const staleEdit = await request(app)
      .put(`/api/workspaces/${owner.workspace.id}/missions/${created.body.mission.id}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send(missionPayload({ title: 'Stale second tab update', expected_updated_at: originalVersion }));
    expect(staleEdit.status).toBe(409);
    expect(staleEdit.body.code).toBe('mission_changed');
    const stored = await getProductMission(created.body.mission.id, owner.workspace.id);
    expect(stored.title).toBe('First tab update');
  });

  it('allows only one tab to claim proposal approval', async () => {
    const owner = await register('mission-concurrent-approval@test.io');
    const proposal = {
      repository: 'acme/shop',
      default_branch: 'main',
      base_sha: 'base-sha',
      summary: 'Guard checkout totals.',
      user_impact: 'Customers can finish checkout.',
      root_cause: 'A nullable value is added directly.',
      acceptance_criteria: ['The checkout total remains numeric.'],
      risks: [],
      manual_review: [],
      source_files: [{ path: 'src/total.js', sha: 'file-sha' }],
      files: [{ path: 'src/total.js', content: 'export const total = () => 0;\n' }],
    };
    proposal.proposal_hash = hashMissionProposal(proposal);
    let finishPullRequest;
    const createPullRequest = vi.fn(() => new Promise(resolve => {
      finishPullRequest = () => resolve({
        url: 'https://github.com/acme/shop/pull/22',
        number: 22,
        branch: 'fetchlab/mission-concurrent',
        head_sha: 'head-sha',
        base_sha: 'base-sha',
        repository: 'acme/shop',
      });
    }));
    const flowApp = injectedApp({
      investigate: async () => ({ outcome: 'proposed', investigation: {}, proposal }),
      createPullRequest,
      providerForRequest: async () => ({ provider: { name: 'test' }, source: 'test' }),
    });
    const created = await request(flowApp)
      .post(`/api/workspaces/${owner.workspace.id}/missions`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send(missionPayload());
    const missionId = created.body.mission.id;
    await request(flowApp)
      .post(`/api/workspaces/${owner.workspace.id}/missions/${missionId}/investigate`)
      .set('Authorization', `Bearer ${owner.token}`);

    const firstApproval = request(flowApp)
      .post(`/api/workspaces/${owner.workspace.id}/missions/${missionId}/approve`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ proposal_hash: proposal.proposal_hash })
      .then(response => response);
    await vi.waitFor(() => expect(createPullRequest).toHaveBeenCalledTimes(1));

    const competingApproval = await request(flowApp)
      .post(`/api/workspaces/${owner.workspace.id}/missions/${missionId}/approve`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ proposal_hash: proposal.proposal_hash });
    expect(competingApproval.status).toBe(409);
    expect(createPullRequest).toHaveBeenCalledTimes(1);

    finishPullRequest();
    const approved = await firstApproval;
    expect(approved.status).toBe(200);
    expect(approved.body.mission.status).toBe('awaiting_validation');
  });

  it('binds approval to the investigated proposal and reports CI truthfully', async () => {
    const owner = await register('mission-flow@test.io');
    const proposal = {
      repository: 'acme/shop',
      default_branch: 'main',
      base_sha: 'base-sha',
      summary: 'Guard the checkout total helper.',
      user_impact: 'The total remains numeric when a discount has no amount.',
      root_cause: 'Nullable values are added without normalization.',
      acceptance_criteria: ['A missing discount amount never produces NaN.'],
      risks: ['Confirm zero is the intended fallback.'],
      manual_review: ['Review fallback semantics.'],
      source_files: [{ path: 'src/total.js', sha: 'file-sha' }],
      files: [{
        path: 'src/total.js',
        existing: true,
        original_sha: 'file-sha',
        explanation: 'Normalize missing values.',
        content: 'export const total = (a, b) => (a || 0) + (b || 0);\n',
      }],
    };
    proposal.proposal_hash = hashMissionProposal(proposal);
    const investigate = vi.fn(async () => ({
      outcome: 'proposed',
      investigation: {
        repository: 'acme/shop',
        default_branch: 'main',
        base_sha: 'base-sha',
        selected_files: [{ path: 'src/total.js', sha: 'file-sha' }],
        availability: { reachable: true, status: 200, claim: 'Availability only.' },
      },
      proposal,
    }));
    const createPullRequest = vi.fn(async ({ proposalHash }) => ({
      url: 'https://github.com/acme/shop/pull/17',
      number: 17,
      branch: 'fetchlab/mission-123',
      head_sha: 'head-sha',
      base_sha: 'base-sha',
      repository: 'acme/shop',
      approved_hash: proposalHash,
    }));
    const validationIdentity = {
      head_sha: 'head-sha',
      base_sha: 'base-sha',
      base_branch: 'main',
      pull_request_state: 'open',
      draft: true,
    };
    const readValidation = vi.fn()
      .mockResolvedValueOnce({ state: 'unverified', verified: false, checks: [], ...validationIdentity, checked_at: new Date().toISOString() })
      .mockResolvedValueOnce({ state: 'passed', verified: true, checks: [{ name: 'test', status: 'completed', conclusion: 'success' }], ...validationIdentity, checked_at: new Date().toISOString() })
      .mockResolvedValueOnce({ state: 'passed', verified: true, checks: [{ name: 'test', status: 'completed', conclusion: 'success' }], ...validationIdentity, head_sha: 'changed-head-sha', checked_at: new Date().toISOString() });
    const flowApp = injectedApp({
      investigate,
      createPullRequest,
      readValidation,
      providerForRequest: async () => ({ provider: { name: 'test' }, source: 'test' }),
    });

    const created = await request(flowApp)
      .post(`/api/workspaces/${owner.workspace.id}/missions`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send(missionPayload());
    expect(created.status).toBe(201);
    const missionId = created.body.mission.id;

    const investigated = await request(flowApp)
      .post(`/api/workspaces/${owner.workspace.id}/missions/${missionId}/investigate`)
      .set('Authorization', `Bearer ${owner.token}`);
    expect(investigated.status).toBe(200);
    expect(investigated.body.mission.status).toBe('proposed');
    expect(investigated.body.mission.proposal_hash).toBe(proposal.proposal_hash);

    const staleApproval = await request(flowApp)
      .post(`/api/workspaces/${owner.workspace.id}/missions/${missionId}/approve`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ proposal_hash: 'stale-hash' });
    expect(staleApproval.status).toBe(409);
    expect(createPullRequest).not.toHaveBeenCalled();

    const approved = await request(flowApp)
      .post(`/api/workspaces/${owner.workspace.id}/missions/${missionId}/approve`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ proposal_hash: proposal.proposal_hash });
    expect(approved.status).toBe(200);
    expect(approved.body.mission.status).toBe('awaiting_validation');
    expect(createPullRequest).toHaveBeenCalledWith(
      expect.objectContaining({ proposalHash: proposal.proposal_hash }),
      expect.objectContaining({ token: 'test-token', repo: 'acme/shop', source: 'server' }),
    );
    const stored = await getProductMission(missionId, owner.workspace.id);
    expect(stored.data.proposal.files[0].content).toMatch(/^v1:/);

    const unverified = await request(flowApp)
      .post(`/api/workspaces/${owner.workspace.id}/missions/${missionId}/validation`)
      .set('Authorization', `Bearer ${owner.token}`);
    expect(unverified.body.mission.status).toBe('awaiting_validation');
    expect(unverified.body.mission.data.validation.state).toBe('unverified');

    const verified = await request(flowApp)
      .post(`/api/workspaces/${owner.workspace.id}/missions/${missionId}/validation`)
      .set('Authorization', `Bearer ${owner.token}`);
    expect(verified.body.mission.status).toBe('ready_for_review');
    expect(verified.body.mission.data.validation.verified).toBe(true);

    const changed = await request(flowApp)
      .post(`/api/workspaces/${owner.workspace.id}/missions/${missionId}/validation`)
      .set('Authorization', `Bearer ${owner.token}`);
    expect(changed.body.mission.status).toBe('validation_failed');
    expect(changed.body.mission.data.validation).toMatchObject({
      state: 'failed',
      verified: false,
      integrity: { passed: false },
    });
    expect(changed.body.mission.data.validation.integrity.failures).toContain(
      'The pull request head no longer matches the exact approved commit.',
    );
    expect(verified.body.events.map(event => event.event_type)).toEqual(expect.arrayContaining([
      'mission.captured',
      'investigation.started',
      'proposal.prepared',
      'pull_request.opened',
      'validation.unverified',
      'validation.passed',
    ]));

    const duplicateApproval = await request(flowApp)
      .post(`/api/workspaces/${owner.workspace.id}/missions/${missionId}/approve`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ proposal_hash: proposal.proposal_hash });
    expect(duplicateApproval.status).toBe(409);
    expect(createPullRequest).toHaveBeenCalledTimes(1);
  });
});
