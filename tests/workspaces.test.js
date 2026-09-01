import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { initDb, _resetForTests } from '../server/db.js';
import { resetKeyCache } from '../server/encryption.js';

let app;

beforeAll(async () => {
  process.env.JWT_SECRET = 'workspaces-test-secret-very-long-key';
  process.env.APP_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  resetKeyCache();
  delete process.env.DATABASE_URL;
  delete process.env.FETCHLAB_DATA_FILE;
  await initDb();
  const { buildApp } = await import('../server/app.js');
  app = await buildApp({ skipDbInit: true });
});

beforeEach(async () => {
  _resetForTests();
});

async function register(email) {
  const res = await request(app).post('/api/auth/register').send({ email, password: 'password123' });
  return { token: res.body.token, user: res.body.user };
}

async function getPersonalWorkspace(token) {
  const res = await request(app).get('/api/workspaces').set('Authorization', `Bearer ${token}`);
  return res.body.workspaces[0];
}

describe('Workspaces CRUD', () => {
  it('creates a personal workspace on register', async () => {
    const { token } = await register('owner@test.io');
    const ws = await getPersonalWorkspace(token);
    expect(ws.name).toBe('Personal');
    expect(ws.member_role).toBe('admin');
  });

  it('lets the owner create another workspace', async () => {
    const { token } = await register('multi@test.io');
    const res = await request(app)
      .post('/api/workspaces')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Side project' });
    expect(res.status).toBe(200);
    expect(res.body.workspace.name).toBe('Side project');
  });

  it('scopes collections to a workspace', async () => {
    const { token } = await register('coll@test.io');
    const ws = await getPersonalWorkspace(token);

    const create = await request(app)
      .post(`/api/workspaces/${ws.id}/collections`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'My API', data: { count: 1 } });
    expect(create.status).toBe(200);

    const list = await request(app)
      .get(`/api/workspaces/${ws.id}/collections`)
      .set('Authorization', `Bearer ${token}`);
    expect(list.body.collections).toHaveLength(1);
    expect(list.body.collections[0].name).toBe('My API');
  });

  it('encrypts sensitive fields in environments at rest, decrypts on read', async () => {
    const { token } = await register('enc@test.io');
    const ws = await getPersonalWorkspace(token);
    const create = await request(app)
      .post(`/api/workspaces/${ws.id}/environments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'prod', data: { api_key: 'super-secret-token' } });
    expect(create.status).toBe(200);

    const list = await request(app)
      .get(`/api/workspaces/${ws.id}/environments`)
      .set('Authorization', `Bearer ${token}`);
    expect(list.body.environments[0].data.api_key).toBe('super-secret-token');
  });

  it('blocks non-members from accessing a workspace', async () => {
    const a = await register('a@test.io');
    const b = await register('b@test.io');
    const aWs = await getPersonalWorkspace(a.token);
    const res = await request(app)
      .get(`/api/workspaces/${aWs.id}/collections`)
      .set('Authorization', `Bearer ${b.token}`);
    expect(res.status).toBe(403);
  });

  it('lets the admin add and remove members', async () => {
    const a = await register('owner-mem@test.io');
    await register('joiner@test.io');
    const aWs = await getPersonalWorkspace(a.token);

    const add = await request(app)
      .post(`/api/workspaces/${aWs.id}/members`)
      .set('Authorization', `Bearer ${a.token}`)
      .send({ email: 'joiner@test.io', role: 'member' });
    expect(add.status).toBe(200);
    expect(add.body.role).toBe('member');

    const list = await request(app)
      .get(`/api/workspaces/${aWs.id}/members`)
      .set('Authorization', `Bearer ${a.token}`);
    expect(list.body.members.length).toBe(2);

    const update = await request(app)
      .put(`/api/workspaces/${aWs.id}/members/${add.body.user_id}`)
      .set('Authorization', `Bearer ${a.token}`)
      .send({ role: 'viewer' });
    expect(update.status).toBe(200);
    expect(update.body.role).toBe('viewer');

    const remove = await request(app)
      .delete(`/api/workspaces/${aWs.id}/members/${add.body.user_id}`)
      .set('Authorization', `Bearer ${a.token}`);
    expect(remove.status).toBe(200);
  });

  it('viewers cannot mutate collections', async () => {
    const a = await register('vowner@test.io');
    const v = await register('viewer@test.io');
    const aWs = await getPersonalWorkspace(a.token);
    await request(app).post(`/api/workspaces/${aWs.id}/members`).set('Authorization', `Bearer ${a.token}`).send({ email: 'viewer@test.io', role: 'viewer' });

    const create = await request(app)
      .post(`/api/workspaces/${aWs.id}/collections`)
      .set('Authorization', `Bearer ${v.token}`)
      .send({ name: 'nope' });
    expect(create.status).toBe(403);
  });
});

describe('Autonomy studies', () => {
  it('creates, lists, deletes, and audits a workspace study', async () => {
    const owner = await register('autonomy-owner@test.io');
    const workspace = await getPersonalWorkspace(owner.token);
    const studyId = '11111111-1111-4111-8111-111111111111';

    const create = await request(app)
      .post(`/api/workspaces/${workspace.id}/autonomy-studies`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({
        id: studyId,
        name: 'Refund authority study',
        status: 'pilot',
        data: {
          id: studyId,
          name: 'Refund authority study',
          status: 'pilot',
          workflow: 'Review refund exceptions',
          selectedLevel: 'approval',
        },
      });
    expect(create.status).toBe(200);
    expect(create.body.study.id).toBe(studyId);

    const list = await request(app)
      .get(`/api/workspaces/${workspace.id}/autonomy-studies`)
      .set('Authorization', `Bearer ${owner.token}`);
    expect(list.status).toBe(200);
    expect(list.body.studies).toHaveLength(1);
    expect(list.body.studies[0].data.workflow).toBe('Review refund exceptions');

    const audit = await request(app)
      .get('/api/audit')
      .set('Authorization', `Bearer ${owner.token}`);
    expect(audit.body.entries.map(entry => entry.action)).toContain('autonomy.study.upsert');

    const remove = await request(app)
      .delete(`/api/workspaces/${workspace.id}/autonomy-studies/${studyId}`)
      .set('Authorization', `Bearer ${owner.token}`);
    expect(remove.status).toBe(200);

    const empty = await request(app)
      .get(`/api/workspaces/${workspace.id}/autonomy-studies`)
      .set('Authorization', `Bearer ${owner.token}`);
    expect(empty.body.studies).toEqual([]);
  });

  it('allows viewer reads, blocks viewer writes, and rejects cross-workspace id reuse', async () => {
    const owner = await register('autonomy-admin@test.io');
    const viewer = await register('autonomy-viewer@test.io');
    const ownerWorkspace = await getPersonalWorkspace(owner.token);
    const viewerWorkspace = await getPersonalWorkspace(viewer.token);
    const studyId = '22222222-2222-4222-8222-222222222222';

    await request(app)
      .post(`/api/workspaces/${ownerWorkspace.id}/members`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ email: 'autonomy-viewer@test.io', role: 'viewer' });

    const create = await request(app)
      .post(`/api/workspaces/${ownerWorkspace.id}/autonomy-studies`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ id: studyId, name: 'Scoped study', status: 'draft', data: { id: studyId } });
    expect(create.status).toBe(200);

    const read = await request(app)
      .get(`/api/workspaces/${ownerWorkspace.id}/autonomy-studies`)
      .set('Authorization', `Bearer ${viewer.token}`);
    expect(read.status).toBe(200);
    expect(read.body.studies).toHaveLength(1);

    const viewerWrite = await request(app)
      .post(`/api/workspaces/${ownerWorkspace.id}/autonomy-studies`)
      .set('Authorization', `Bearer ${viewer.token}`)
      .send({ name: 'Blocked', data: {} });
    expect(viewerWrite.status).toBe(403);

    const crossWorkspace = await request(app)
      .post(`/api/workspaces/${viewerWorkspace.id}/autonomy-studies`)
      .set('Authorization', `Bearer ${viewer.token}`)
      .send({ id: studyId, name: 'Collision', status: 'draft', data: { id: studyId } });
    expect(crossWorkspace.status).toBe(409);
  });
});
describe('Tunnel handoff', () => {
  it('validates the saved authority, forwards the exact task envelope, and audits the handoff', async () => {
    const owner = await register('tunnel-owner@test.io');
    const workspace = await getPersonalWorkspace(owner.token);
    const studyId = '33333333-3333-4333-8333-333333333333';
    await request(app)
      .post(`/api/workspaces/${workspace.id}/autonomy-studies`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({
        id: studyId,
        name: 'Approval workflow',
        status: 'decided',
        data: { id: studyId, name: 'Approval workflow', selectedLevel: 'approval' },
      });

    process.env.TUNNEL_URL = 'http://tunnel.internal:8000';
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ task_id: 'tunnel-task-1' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    try {
      const handoff = {
        kind: 'agent-tunnel.task',
        objective: 'Implement the approved workflow without increasing authority.',
        agents: ['untrusted-client-agent'],
        budget_mode: 'unbounded',
        autonomy_contract: {
          study_id: studyId,
          authority: { selected_level: 'approval' },
        },
      };
      const responseValue = await request(app)
        .post(`/api/workspaces/${workspace.id}/autonomy-studies/${studyId}/tunnel`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ handoff });

      expect(responseValue.status).toBe(200);
      expect(responseValue.body.task_id).toBe('tunnel-task-1');
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls[0][0]).toBe('http://tunnel.internal:8000/api/tasks');
      const forwarded = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(forwarded).toEqual({
        objective: handoff.objective,
        agents: [],
        budget_mode: 'standard',
      });

      const audit = await request(app)
        .get('/api/audit')
        .set('Authorization', `Bearer ${owner.token}`);
      expect(audit.body.entries.map(entry => entry.action)).toContain('autonomy.study.handoff');
    } finally {
      fetchMock.mockRestore();
      delete process.env.TUNNEL_URL;
    }
  });

  it('rejects a handoff that raises the saved authority ceiling', async () => {
    const owner = await register('tunnel-tamper@test.io');
    const workspace = await getPersonalWorkspace(owner.token);
    const studyId = '44444444-4444-4444-8444-444444444444';
    await request(app)
      .post(`/api/workspaces/${workspace.id}/autonomy-studies`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({
        id: studyId,
        name: 'Draft workflow',
        status: 'decided',
        data: { id: studyId, selectedLevel: 'draft' },
      });

    process.env.TUNNEL_URL = 'http://tunnel.internal:8000';
    try {
      const responseValue = await request(app)
        .post(`/api/workspaces/${workspace.id}/autonomy-studies/${studyId}/tunnel`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({
          handoff: {
            kind: 'agent-tunnel.task',
            objective: 'Raise authority',
            autonomy_contract: {
              study_id: studyId,
              authority: { selected_level: 'autonomous' },
            },
          },
        });
      expect(responseValue.status).toBe(409);
    } finally {
      delete process.env.TUNNEL_URL;
    }
  });
});
describe('Audit log', () => {
  it('records register and login events', async () => {
    const a = await register('audit@test.io');
    await request(app).post('/api/auth/login').send({ email: 'audit@test.io', password: 'password123' });
    const list = await request(app).get('/api/audit').set('Authorization', `Bearer ${a.token}`);
    expect(list.status).toBe(200);
    const actions = list.body.entries.map(e => e.action);
    expect(actions).toContain('auth.register');
    expect(actions).toContain('auth.login');
  });

  it('rejects non-admins', async () => {
    await register('first-admin@test.io'); // becomes admin
    const u = await register('not-admin@test.io');
    const res = await request(app).get('/api/audit').set('Authorization', `Bearer ${u.token}`);
    expect(res.status).toBe(403);
  });
});
