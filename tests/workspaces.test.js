import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
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
