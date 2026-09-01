import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { getAuthorityEvent, getAuthorityPolicyRevision, initDb, _resetForTests } from '../server/db.js';
import { isEncrypted, resetKeyCache } from '../server/encryption.js';

let app;

beforeAll(async () => {
  process.env.JWT_SECRET = 'authority-test-secret-that-is-long-enough';
  process.env.APP_ENCRYPTION_KEY = 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789';
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
  expect(response.status).toBe(200);
  return { token: response.body.token, user: response.body.user };
}

async function personalWorkspace(token) {
  const response = await request(app).get('/api/workspaces').set('Authorization', `Bearer ${token}`);
  return response.body.workspaces[0];
}

async function createStudy(token, workspaceId, id) {
  const response = await request(app)
    .post(`/api/workspaces/${workspaceId}/autonomy-studies`)
    .set('Authorization', `Bearer ${token}`)
    .send({ id, name: 'Production action gate', status: 'draft', data: { id } });
  expect(response.status).toBe(200);
  return response.body.study;
}

function rule(effect, overrides = {}) {
  return {
    id: `${effect}-refund`,
    name: `${effect} refund`,
    enabled: true,
    effect,
    toolPattern: 'stripe.refunds.create',
    operation: 'write',
    targetPattern: 'stripe://charges/*/refund',
    constraints: [{ path: 'amount', operator: 'lte', value: 100 }],
    ...overrides,
  };
}

function policy(effect, mode = 'enforce') {
  return { version: 1, mode, defaultDecision: 'deny', rules: [rule(effect)] };
}

const refundAction = {
  agent_id: 'refund-agent',
  session_id: 'session-42',
  tool: 'stripe.refunds.create',
  operation: 'write',
  target: 'stripe://charges/ch_123/refund',
  arguments: { amount: 75, authorization: 'Bearer production-secret' },
  reversible: false,
};

async function savePolicy(token, workspaceId, studyId, value) {
  return request(app)
    .put(`/api/workspaces/${workspaceId}/autonomy-studies/${studyId}/authority/draft`)
    .set('Authorization', `Bearer ${token}`)
    .send({ policy: value });
}

async function publish(token, workspaceId, studyId, expectedRevision) {
  return request(app)
    .post(`/api/workspaces/${workspaceId}/autonomy-studies/${studyId}/authority/publish`)
    .set('Authorization', `Bearer ${token}`)
    .send({ expected_revision: expectedRevision });
}

async function createCredential(token, workspaceId) {
  const response = await request(app)
    .post(`/api/workspaces/${workspaceId}/authority-tokens`)
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'CI runtime' });
  expect(response.status).toBe(201);
  return response.body;
}

async function check(gateToken, studyId, action, key) {
  return request(app)
    .post('/api/authority/check')
    .set('Authorization', `Bearer ${gateToken}`)
    .set('Idempotency-Key', key)
    .send({ study_id: studyId, action });
}

describe('authority runtime', () => {
  it('publishes an immutable policy and returns idempotent allow and fail-closed decisions', async () => {
    const owner = await register('authority-allow@test.io');
    const workspace = await personalWorkspace(owner.token);
    const studyId = '71111111-1111-4111-8111-111111111111';
    await createStudy(owner.token, workspace.id, studyId);

    expect((await savePolicy(owner.token, workspace.id, studyId, policy('allow'))).status).toBe(200);
    const firstPublish = await publish(owner.token, workspace.id, studyId, 0);
    expect(firstPublish.status).toBe(201);
    expect(firstPublish.body.revision).toMatchObject({ revision: 1, prior_fingerprint: null });

    const credential = await createCredential(owner.token, workspace.id);
    expect(credential.token).toMatch(/^flk_/);
    expect(credential.credential).not.toHaveProperty('token_hash');

    const allowed = await check(credential.token, studyId, refundAction, 'allow-1');
    expect(allowed.status).toBe(201);
    expect(allowed.body).toMatchObject({
      decision: 'allow',
      execute: true,
      mode: 'enforce',
      policy_revision: 1,
      reused: false,
    });

    const retry = await check(credential.token, studyId, refundAction, 'allow-1');
    expect(retry.status).toBe(200);
    expect(retry.body).toMatchObject({ event_id: allowed.body.event_id, reused: true });

    const conflictingRetry = await check(credential.token, studyId, { ...refundAction, target: 'stripe://charges/ch_999/refund' }, 'allow-1');
    expect(conflictingRetry.status).toBe(409);

    const unknown = await check(credential.token, studyId, {
      ...refundAction,
      tool: 'github.repos.delete',
      operation: 'delete',
      target: 'github://repos/fetchlab',
    }, 'deny-1');
    expect(unknown.status).toBe(201);
    expect(unknown.body).toMatchObject({ decision: 'deny', execute: false, matched_rule_id: null });

    const stored = await getAuthorityEvent(allowed.body.event_id, workspace.id);
    expect(isEncrypted(stored.action_data.arguments.authorization)).toBe(true);

    const state = await request(app)
      .get(`/api/workspaces/${workspace.id}/autonomy-studies/${studyId}/authority`)
      .set('Authorization', `Bearer ${owner.token}`);
    expect(state.status).toBe(200);
    expect(state.body.events.find((event) => event.event_id === allowed.body.event_id).action.arguments.authorization).toBe('[REDACTED]');
    expect(state.body.diff.total_events).toBe(2);

    const credentials = await request(app)
      .get(`/api/workspaces/${workspace.id}/authority-tokens`)
      .set('Authorization', `Bearer ${owner.token}`);
    expect(credentials.body.credentials[0]).not.toHaveProperty('token_hash');
    expect(credentials.body.credentials[0]).not.toHaveProperty('token');
  });

  it('binds a human approval to one exact action and consumes it once', async () => {
    const owner = await register('authority-approval@test.io');
    const workspace = await personalWorkspace(owner.token);
    const studyId = '72222222-2222-4222-8222-222222222222';
    await createStudy(owner.token, workspace.id, studyId);
    await savePolicy(owner.token, workspace.id, studyId, policy('require_approval'));
    expect((await publish(owner.token, workspace.id, studyId, 0)).status).toBe(201);
    const credential = await createCredential(owner.token, workspace.id);

    const pending = await check(credential.token, studyId, refundAction, 'approval-1');
    expect(pending.body).toMatchObject({ decision: 'require_approval', execute: false, review_status: 'pending' });

    const tooEarly = await request(app)
      .post(`/api/authority/events/${pending.body.event_id}/consume`)
      .set('Authorization', `Bearer ${credential.token}`)
      .send({ action: refundAction });
    expect(tooEarly.status).toBe(409);

    const approval = await request(app)
      .post(`/api/workspaces/${workspace.id}/autonomy-studies/${studyId}/authority/events/${pending.body.event_id}/review`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ verdict: 'approved', expires_in_seconds: 300, note: 'Charge verified.' });
    expect(approval.status).toBe(200);
    expect(approval.body.event).toMatchObject({ review_status: 'approved', execute: false });

    const changedPayload = await request(app)
      .post(`/api/authority/events/${pending.body.event_id}/consume`)
      .set('Authorization', `Bearer ${credential.token}`)
      .send({ action: { ...refundAction, arguments: { ...refundAction.arguments, amount: 76 } } });
    expect(changedPayload.status).toBe(409);

    const consumed = await request(app)
      .post(`/api/authority/events/${pending.body.event_id}/consume`)
      .set('Authorization', `Bearer ${credential.token}`)
      .send({ action: refundAction });
    expect(consumed.status).toBe(200);
    expect(consumed.body).toMatchObject({ execute: true, review_status: 'approved' });

    const secondUse = await request(app)
      .post(`/api/authority/events/${pending.body.event_id}/consume`)
      .set('Authorization', `Bearer ${credential.token}`)
      .send({ action: refundAction });
    expect(secondUse.status).toBe(409);
    expect(secondUse.body.error).toMatch(/already consumed/i);
  });

  it('blocks a policy release until every observed authority expansion is reviewed', async () => {
    const owner = await register('authority-change@test.io');
    const workspace = await personalWorkspace(owner.token);
    const studyId = '73333333-3333-4333-8333-333333333333';
    await createStudy(owner.token, workspace.id, studyId);
    await savePolicy(owner.token, workspace.id, studyId, policy('deny'));
    expect((await publish(owner.token, workspace.id, studyId, 0)).status).toBe(201);
    const credential = await createCredential(owner.token, workspace.id);

    const denied = await check(credential.token, studyId, refundAction, 'expansion-evidence');
    expect(denied.body.decision).toBe('deny');

    await savePolicy(owner.token, workspace.id, studyId, policy('allow'));
    const state = await request(app)
      .get(`/api/workspaces/${workspace.id}/autonomy-studies/${studyId}/authority`)
      .set('Authorization', `Bearer ${owner.token}`);
    expect(state.body.diff).toMatchObject({ expansion_count: 1, unresolved_expansion_count: 1 });
    expect(state.body.diff.rows[0]).toMatchObject({
      eventId: denied.body.event_id,
      previousDecision: 'deny',
      nextDecision: 'allow',
      change: 'expansion',
    });

    const blocked = await publish(owner.token, workspace.id, studyId, 1);
    expect(blocked.status).toBe(409);
    expect(blocked.body.code).toBe('authority_expansions_unreviewed');

    const review = await request(app)
      .post(`/api/workspaces/${workspace.id}/autonomy-studies/${studyId}/authority/expansions/${denied.body.event_id}/review`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ draft_fingerprint: state.body.draft_fingerprint, verdict: 'approved', note: 'Refund limit reviewed.' });
    expect(review.status).toBe(200);

    const released = await publish(owner.token, workspace.id, studyId, 1);
    expect(released.status).toBe(201);
    expect(released.body.revision).toMatchObject({ revision: 2 });

    const staleTab = await publish(owner.token, workspace.id, studyId, 1);
    expect(staleTab.status).toBe(409);
    expect(staleTab.body.current_revision).toBe(2);

    const nowAllowed = await check(credential.token, studyId, refundAction, 'after-expansion');
    expect(nowAllowed.body).toMatchObject({ decision: 'allow', execute: true, policy_revision: 2 });
  });

  it('creates no evidence for invalid input and rejects revoked credentials', async () => {
    const owner = await register('authority-invalid@test.io');
    const workspace = await personalWorkspace(owner.token);
    const studyId = '74444444-4444-4444-8444-444444444444';
    await createStudy(owner.token, workspace.id, studyId);
    const credential = await createCredential(owner.token, workspace.id);

    const invalid = await check(credential.token, studyId, { ...refundAction, arguments: [] }, 'invalid-action');
    expect(invalid.status).toBe(400);
    const state = await request(app)
      .get(`/api/workspaces/${workspace.id}/autonomy-studies/${studyId}/authority`)
      .set('Authorization', `Bearer ${owner.token}`);
    expect(state.body.diff.total_events).toBe(0);

    const revoke = await request(app)
      .delete(`/api/workspaces/${workspace.id}/authority-tokens/${credential.credential.id}`)
      .set('Authorization', `Bearer ${owner.token}`);
    expect(revoke.status).toBe(200);
    const rejected = await check(credential.token, studyId, refundAction, 'revoked-action');
    expect(rejected.status).toBe(401);
  });

  it('limits destructive gate deletion to admins and cascades local evidence', async () => {
    const owner = await register('authority-delete-owner@test.io');
    const member = await register('authority-delete-member@test.io');
    const workspace = await personalWorkspace(owner.token);
    const studyId = '75555555-5555-4555-8555-555555555555';

    const invite = await request(app)
      .post(`/api/workspaces/${workspace.id}/members`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ email: member.user.email, role: 'member' });
    expect(invite.status).toBe(200);

    await createStudy(owner.token, workspace.id, studyId);
    await savePolicy(owner.token, workspace.id, studyId, policy('allow'));
    expect((await publish(owner.token, workspace.id, studyId, 0)).status).toBe(201);
    const credential = await createCredential(owner.token, workspace.id);
    const decision = await check(credential.token, studyId, refundAction, 'delete-evidence');
    expect(decision.status).toBe(201);

    const memberDelete = await request(app)
      .delete(`/api/workspaces/${workspace.id}/autonomy-studies/${studyId}`)
      .set('Authorization', `Bearer ${member.token}`);
    expect(memberDelete.status).toBe(403);

    const ownerDelete = await request(app)
      .delete(`/api/workspaces/${workspace.id}/autonomy-studies/${studyId}`)
      .set('Authorization', `Bearer ${owner.token}`);
    expect(ownerDelete.status).toBe(200);
    await expect(getAuthorityEvent(decision.body.event_id, workspace.id)).resolves.toBeNull();
    await expect(getAuthorityPolicyRevision(studyId, 1)).resolves.toBeNull();
  });
});
