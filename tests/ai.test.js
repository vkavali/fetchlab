import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import { initDb, _resetForTests } from '../server/db.js';
import { resetKeyCache } from '../server/encryption.js';

let app;
let token;

beforeAll(async () => {
  process.env.JWT_SECRET = 'ai-test-secret-key-very-long';
  process.env.APP_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  process.env.ANTHROPIC_API_KEY = 'sk-ant-mock-key';
  resetKeyCache();
  delete process.env.DATABASE_URL;
  delete process.env.FETCHLAB_DATA_FILE;
  await initDb();
  const { buildApp } = await import('../server/app.js');
  app = await buildApp({ skipDbInit: true });
});

beforeEach(async () => {
  _resetForTests();
  const reg = await request(app)
    .post('/api/auth/register')
    .send({ email: 'ai-user@test.io', password: 'password123' });
  token = reg.body.token;
});

describe('AI HTTP endpoints (mounted ai-routes.js)', () => {
  it('GET /api/ai/status reports enabled (no auth required for status)', async () => {
    const res = await request(app).get('/api/ai/status');
    expect(res.status).toBe(200);
    expect(res.body.enabled).toBe(true);
  });

  it('POST /api/ai/diagnose requires auth', async () => {
    const res = await request(app).post('/api/ai/diagnose').send({ status: 500 });
    expect(res.status).toBe(401);
  });

  it('POST /api/ai/generate-request requires auth', async () => {
    const res = await request(app).post('/api/ai/generate-request').send({ prompt: 'hi' });
    expect(res.status).toBe(401);
  });

  it('POST /api/ai/generate-tests requires auth', async () => {
    const res = await request(app).post('/api/ai/generate-tests').send({ status: 200 });
    expect(res.status).toBe(401);
  });

  it('POST /api/ai/explain-diff requires auth', async () => {
    const res = await request(app).post('/api/ai/explain-diff').send({ changes: [] });
    expect(res.status).toBe(401);
  });

  it('POST /api/ai/generate-spec requires auth', async () => {
    const res = await request(app).post('/api/ai/generate-spec').send({ requests: [] });
    expect(res.status).toBe(401);
  });

  it('POST /api/ai/generate-request rejects malformed payload (when authed)', async () => {
    const res = await request(app)
      .post('/api/ai/generate-request')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(400);
  });
});
