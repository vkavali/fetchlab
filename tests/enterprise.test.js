import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import { initDb, _resetForTests } from '../server/db.js';
import { resetKeyCache } from '../server/encryption.js';

let app;

beforeAll(async () => {
  process.env.JWT_SECRET = 'enterprise-test-secret-very-long-key';
  process.env.APP_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  process.env.SCIM_BEARER_TOKEN = 'scim-test-token';
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
  const res = await request(app).post('/api/auth/register').send({ email, password: 'password123' });
  return { token: res.body.token, user: res.body.user };
}

describe('Enterprise controls', () => {
  it('exposes readiness and settings to admins only', async () => {
    const admin = await register('enterprise-admin@test.io');
    const user = await register('enterprise-user@test.io');

    const blocked = await request(app)
      .get('/api/enterprise/settings')
      .set('Authorization', `Bearer ${user.token}`);
    expect(blocked.status).toBe(403);

    const settings = await request(app)
      .get('/api/enterprise/settings')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(settings.status).toBe(200);
    expect(settings.body.settings.data_retention_days).toBe(365);

    const readiness = await request(app)
      .get('/api/enterprise/readiness')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(readiness.status).toBe(200);
    expect(readiness.body.enterprise_backend_baseline).toBe(true);
    expect(readiness.body.soc2_certified).toBe(false);
    expect(readiness.body.controls.map(c => c.key)).toContain('scim');
  });

  it('updates enterprise settings and reports SCIM status', async () => {
    const admin = await register('settings-admin@test.io');

    const update = await request(app)
      .put('/api/enterprise/settings')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        data_retention_days: 90,
        audit_retention_days: 180,
        soc2_evidence_retention_days: 365,
        scim_enabled: true,
        sso_required: true,
      });
    expect(update.status).toBe(200);
    expect(update.body.settings.audit_retention_days).toBe(180);
    expect(update.body.settings.scim_enabled).toBe(true);

    const scim = await request(app)
      .get('/api/enterprise/scim/status')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(scim.status).toBe(200);
    expect(scim.body.configured).toBe(true);

    const audit = await request(app)
      .get('/api/audit')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(audit.body.entries.map(e => e.action)).toContain('enterprise.settings.update');
  });

  it('lets admins disable users and blocks disabled login', async () => {
    const admin = await register('user-admin@test.io');
    const user = await register('disable-me@test.io');

    const disable = await request(app)
      .patch(`/api/enterprise/users/${user.user.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ disabled: true });
    expect(disable.status).toBe(200);
    expect(disable.body.user.disabled_at).toBeTruthy();

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'disable-me@test.io', password: 'password123' });
    expect(login.status).toBe(403);

    const selfDisable = await request(app)
      .patch(`/api/enterprise/users/${admin.user.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ disabled: true });
    expect(selfDisable.status).toBe(400);
  });

  it('runs retention and records an audit event', async () => {
    const admin = await register('retention-admin@test.io');

    const run = await request(app)
      .post('/api/enterprise/retention/run')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(run.status).toBe(200);
    expect(run.body.ok).toBe(true);
    expect(run.body.counts).toHaveProperty('audit_log');

    const audit = await request(app)
      .get('/api/audit')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(audit.body.entries.map(e => e.action)).toContain('enterprise.retention.run');
  });

  it('tracks SOC 2 evidence without claiming certification', async () => {
    const admin = await register('soc2-admin@test.io');

    const create = await request(app)
      .post('/api/enterprise/soc2/evidence')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        control_id: 'CC6.1',
        title: 'RBAC role matrix',
        owner: 'security',
        status: 'collected',
        detail: { path: 'docs/rbac.md' },
      });
    expect(create.status).toBe(200);
    expect(create.body.evidence.status).toBe('collected');

    const list = await request(app)
      .get('/api/enterprise/soc2/evidence')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(list.status).toBe(200);
    expect(list.body.certified).toBe(false);
    expect(list.body.evidence).toHaveLength(1);
    expect(list.body.controls.map(c => c.id)).toContain('CC6.1');
  });

  it('supports token-authenticated SCIM user provisioning when enabled', async () => {
    const admin = await register('scim-admin@test.io');
    await request(app)
      .put('/api/enterprise/settings')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ scim_enabled: true });

    const unauthorized = await request(app).get('/api/enterprise/scim/v2/Users');
    expect(unauthorized.status).toBe(401);

    const create = await request(app)
      .post('/api/enterprise/scim/v2/Users')
      .set('Authorization', 'Bearer scim-test-token')
      .send({
        userName: 'scim-user@test.io',
        name: { formatted: 'SCIM User' },
        active: true,
      });
    expect(create.status).toBe(201);
    expect(create.body.userName).toBe('scim-user@test.io');
    expect(create.body.active).toBe(true);

    const list = await request(app)
      .get('/api/enterprise/scim/v2/Users?filter=userName%20eq%20%22scim-user@test.io%22')
      .set('Authorization', 'Bearer scim-test-token');
    expect(list.status).toBe(200);
    expect(list.body.totalResults).toBe(1);

    const disable = await request(app)
      .delete(`/api/enterprise/scim/v2/Users/${create.body.id}`)
      .set('Authorization', 'Bearer scim-test-token');
    expect(disable.status).toBe(204);

    const fetched = await request(app)
      .get(`/api/enterprise/scim/v2/Users/${create.body.id}`)
      .set('Authorization', 'Bearer scim-test-token');
    expect(fetched.body.active).toBe(false);
  });
});
