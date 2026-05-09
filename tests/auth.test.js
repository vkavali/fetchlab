import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import { buildApp } from '../server/app.js';
import { initDb, _resetForTests } from '../server/db.js';
import { signToken, verifyToken } from '../server/auth.js';
import { resetKeyCache } from '../server/encryption.js';

let app;

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-secret-very-long-key-for-tests';
  process.env.APP_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  resetKeyCache();
  delete process.env.DATABASE_URL;
  delete process.env.FETCHLAB_DATA_FILE;
  await initDb();
  app = await buildApp({ skipDbInit: true });
});

beforeEach(async () => {
  _resetForTests();
});

describe('JWT token signing', () => {
  it('signs and verifies a token round-trip', () => {
    const tok = signToken({ id: 'u1', email: 'a@b.c', role: 'user' });
    const payload = verifyToken(tok);
    expect(payload.sub).toBe('u1');
    expect(payload.email).toBe('a@b.c');
    expect(payload.role).toBe('user');
  });

  it('returns null for invalid tokens', () => {
    expect(verifyToken('not.a.token')).toBeNull();
    expect(verifyToken('')).toBeNull();
  });
});

describe('Auth flow', () => {
  it('rejects registration without email/password', async () => {
    const res = await request(app).post('/api/auth/register').send({});
    expect(res.status).toBe(400);
  });

  it('rejects registration with short password', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'a@b.c', password: 'short' });
    expect(res.status).toBe(400);
  });

  it('registers a new user and returns a JWT', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'admin@test.io', password: 'password123', name: 'Admin' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTypeOf('string');
    expect(res.body.user.email).toBe('admin@test.io');
    expect(res.body.user.role).toBe('admin'); // first user
  });

  it('makes the second user a regular "user"', async () => {
    await request(app).post('/api/auth/register').send({ email: 'first@test.io', password: 'password123' });
    const res = await request(app).post('/api/auth/register').send({ email: 'second@test.io', password: 'password123' });
    expect(res.body.user.role).toBe('user');
  });

  it('prevents duplicate registration', async () => {
    await request(app).post('/api/auth/register').send({ email: 'dup@test.io', password: 'password123' });
    const res = await request(app).post('/api/auth/register').send({ email: 'dup@test.io', password: 'password123' });
    expect(res.status).toBe(409);
  });

  it('logs in with correct credentials', async () => {
    await request(app).post('/api/auth/register').send({ email: 'login@test.io', password: 'password123' });
    const res = await request(app).post('/api/auth/login').send({ email: 'login@test.io', password: 'password123' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTypeOf('string');
  });

  it('rejects bad password', async () => {
    await request(app).post('/api/auth/register').send({ email: 'bad@test.io', password: 'password123' });
    const res = await request(app).post('/api/auth/login').send({ email: 'bad@test.io', password: 'wrong-password' });
    expect(res.status).toBe(401);
  });

  it('rejects unknown email', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'nobody@test.io', password: 'password123' });
    expect(res.status).toBe(401);
  });

  it('protects /api/auth/me without a token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns the current user with a Bearer token', async () => {
    const reg = await request(app).post('/api/auth/register').send({ email: 'me@test.io', password: 'password123', name: 'Me' });
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${reg.body.token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('me@test.io');
    expect(Array.isArray(res.body.workspaces)).toBe(true);
    expect(res.body.workspaces.length).toBeGreaterThan(0);
  });

  it('rejects a tampered token', async () => {
    const reg = await request(app).post('/api/auth/register').send({ email: 'tamp@test.io', password: 'password123' });
    const tampered = reg.body.token.slice(0, -2) + 'XX';
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${tampered}`);
    expect(res.status).toBe(401);
  });

  it('protects workspaces endpoint', async () => {
    const res = await request(app).get('/api/workspaces');
    expect(res.status).toBe(401);
  });

  it('returns workspaces for an authed user', async () => {
    const reg = await request(app).post('/api/auth/register').send({ email: 'ws@test.io', password: 'password123' });
    const res = await request(app).get('/api/workspaces').set('Authorization', `Bearer ${reg.body.token}`);
    expect(res.status).toBe(200);
    expect(res.body.workspaces.length).toBe(1); // Personal workspace
    expect(res.body.workspaces[0].name).toBe('Personal');
  });
});

describe('Health endpoint stays public', () => {
  it('does not require auth', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});
