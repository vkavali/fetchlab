import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { buildApp } from '../server/app.js';
import { initDb, _resetForTests } from '../server/db.js';
import * as aiModule from '../server/ai.js';
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
  app = await buildApp({ skipDbInit: true });
});

beforeEach(async () => {
  _resetForTests();
  const reg = await request(app)
    .post('/api/auth/register')
    .send({ email: 'ai-user@test.io', password: 'password123' });
  token = reg.body.token;
});

describe('callAnthropic', () => {
  it('builds the correct request and parses Anthropic response', async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'msg_123', model: 'claude-haiku-4-5-20251001',
        content: [{ type: 'text', text: 'Hello from mock' }],
      }),
    });
    const result = await aiModule.callAnthropic({ prompt: 'hi', fetchImpl: fakeFetch });
    expect(result.text).toBe('Hello from mock');
    expect(result.model).toBe('claude-haiku-4-5-20251001');

    const [url, opts] = fakeFetch.mock.calls[0];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect(opts.method).toBe('POST');
    expect(opts.headers['x-api-key']).toBe('sk-ant-mock-key');
    expect(opts.headers['anthropic-version']).toBe('2023-06-01');
    const body = JSON.parse(opts.body);
    expect(body.messages[0].content).toBe('hi');
  });

  it('throws when API key is missing', async () => {
    const oldKey = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    await expect(aiModule.callAnthropic({ prompt: 'x' })).rejects.toThrow(/ANTHROPIC_API_KEY/);
    process.env.ANTHROPIC_API_KEY = oldKey;
  });

  it('propagates API errors with status', async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: false, status: 429,
      json: async () => ({ error: { message: 'rate limited' } }),
    });
    await expect(aiModule.callAnthropic({ prompt: 'x', fetchImpl: fakeFetch })).rejects.toThrow(/rate limited/);
  });
});

describe('AI HTTP endpoints', () => {
  it('GET /api/ai/status reports enabled', async () => {
    const res = await request(app).get('/api/ai/status').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.enabled).toBe(true);
  });

  it('POST /api/ai/diagnose requires auth', async () => {
    const res = await request(app).post('/api/ai/diagnose').send({ request: {}, response: {} });
    expect(res.status).toBe(401);
  });

  it('POST /api/ai/diagnose returns 400 without payload', async () => {
    const res = await request(app)
      .post('/api/ai/diagnose')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it('POST /api/ai/diagnose returns 503 when ANTHROPIC_API_KEY is missing', async () => {
    const oldKey = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    const res = await request(app)
      .post('/api/ai/diagnose')
      .set('Authorization', `Bearer ${token}`)
      .send({ request: { url: 'https://x', method: 'GET' }, response: { status: 500 } });
    expect(res.status).toBe(503);
    process.env.ANTHROPIC_API_KEY = oldKey;
  });
});
