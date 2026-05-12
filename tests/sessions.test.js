import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import { initDb, _resetForTests } from '../server/db.js';
import { resetKeyCache } from '../server/encryption.js';

let app;

beforeAll(async () => {
  process.env.JWT_SECRET = 'sessions-test-secret-very-long-key';
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

function getCookie(setCookie, name) {
  const list = Array.isArray(setCookie) ? setCookie : (setCookie ? [setCookie] : []);
  for (const c of list) {
    if (c.startsWith(`${name}=`)) {
      const v = c.slice(name.length + 1).split(';')[0];
      return decodeURIComponent(v);
    }
  }
  return null;
}

async function register(email = 'sess@test.io') {
  const res = await request(app).post('/api/auth/register').send({ email, password: 'password123' });
  const cookies = res.headers['set-cookie'];
  return {
    token: res.body.token,
    user: res.body.user,
    cookies,
    refresh: getCookie(cookies, 'fl_refresh'),
  };
}

describe('Session management', () => {
  it('issues a refresh cookie on register and login', async () => {
    const r = await register();
    expect(r.refresh).toBeTypeOf('string');
    expect(r.refresh.includes('.')).toBe(true);
  });

  it('lists active sessions for the user', async () => {
    const r = await register();
    const res = await request(app)
      .get('/api/auth/sessions')
      .set('Authorization', `Bearer ${r.token}`)
      .set('Cookie', `fl_refresh=${r.refresh}`);
    expect(res.status).toBe(200);
    expect(res.body.sessions.length).toBe(1);
    expect(res.body.sessions[0].is_current).toBe(true);
    expect(res.body.sessions[0].revoked_at).toBeFalsy();
  });

  it('rotates refresh tokens and detects reuse', async () => {
    const r = await register('rotate@test.io');

    // First refresh — should succeed and return a new refresh token
    const r1 = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', `fl_refresh=${r.refresh}`);
    expect(r1.status).toBe(200);
    expect(r1.body.token).toBeTypeOf('string');
    expect(r1.body.refresh_token).toBeTypeOf('string');
    expect(r1.body.refresh_token).not.toBe(r.refresh);

    // Second refresh using the OLD token — should detect reuse and revoke ALL
    const r2 = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', `fl_refresh=${r.refresh}`);
    expect(r2.status).toBe(401);
    expect(r2.body.error).toMatch(/reuse/i);

    // The new refresh token should also be revoked now
    const r3 = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', `fl_refresh=${r1.body.refresh_token}`);
    expect(r3.status).toBe(401);
  });

  it('lets a user revoke a specific session', async () => {
    const r = await register('revoke-one@test.io');
    // Login a second device to create a second session
    const r2 = await request(app).post('/api/auth/login').send({ email: 'revoke-one@test.io', password: 'password123' });
    const r2refresh = getCookie(r2.headers['set-cookie'], 'fl_refresh');
    expect(r2refresh).toBeTruthy();
    const r2id = r2refresh.split('.')[0];

    // First device revokes the second device by id
    const del = await request(app)
      .delete(`/api/auth/sessions/${r2id}`)
      .set('Authorization', `Bearer ${r.token}`)
      .set('Cookie', `fl_refresh=${r.refresh}`);
    expect(del.status).toBe(200);

    // r2 refresh should now fail
    const reuse = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', `fl_refresh=${r2refresh}`);
    expect(reuse.status).toBe(401);

    // Original device still works
    const ok = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', `fl_refresh=${r.refresh}`);
    expect(ok.status).toBe(200);
  });

  it('revokes all sessions on revoke-all and forces re-login', async () => {
    const r = await register('revoke-all@test.io');
    await request(app).post('/api/auth/login').send({ email: 'revoke-all@test.io', password: 'password123' });

    const all = await request(app)
      .post('/api/auth/sessions/revoke-all')
      .set('Authorization', `Bearer ${r.token}`)
      .set('Cookie', `fl_refresh=${r.refresh}`);
    expect(all.status).toBe(200);

    const fail = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', `fl_refresh=${r.refresh}`);
    expect(fail.status).toBe(401);
  });

  it('logout revokes the current session', async () => {
    const r = await register('logout@test.io');
    const out = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${r.token}`)
      .set('Cookie', `fl_refresh=${r.refresh}`);
    expect(out.status).toBe(200);

    const fail = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', `fl_refresh=${r.refresh}`);
    expect(fail.status).toBe(401);
  });

  it('returns 401 on /refresh with no token', async () => {
    const res = await request(app).post('/api/auth/refresh');
    expect(res.status).toBe(401);
  });

  it('refuses to revoke another user’s session', async () => {
    const a = await register('alice@test.io');
    const b = await register('bob@test.io');
    const aSessId = a.refresh.split('.')[0];
    const res = await request(app)
      .delete(`/api/auth/sessions/${aSessId}`)
      .set('Authorization', `Bearer ${b.token}`);
    expect(res.status).toBe(404);
  });
});
