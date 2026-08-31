import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import crypto from 'crypto';
import request from 'supertest';
import { buildApp } from '../server/app.js';
import { initDb, _resetForTests } from '../server/db.js';
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

beforeEach(() => {
  _resetForTests();
  delete process.env.SLACK_SIGNING_SECRET;
});

afterEach(() => {
  delete process.env.SLACK_SIGNING_SECRET;
});

async function authToken(email = 'integrations@test.io') {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ email, password: 'password123', name: 'Integration User' });
  return res.body.token;
}

function slackSignature(secret, timestamp, rawBody) {
  return `v0=${crypto
    .createHmac('sha256', secret)
    .update(`v0:${timestamp}:${rawBody}`)
    .digest('hex')}`;
}

describe('integration route auth', () => {
  it('protects the Teams webhook proxy', async () => {
    const res = await request(app).post('/api/teams/test').send({});
    expect(res.status).toBe(401);
  });

  it('keeps Teams validation behind auth', async () => {
    const token = await authToken();
    const res = await request(app)
      .post('/api/teams/test')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Missing url or webhookUrl/);
  });
});

describe('Slack slash-command verification', () => {
  it('allows unsigned Slack command checks in non-production dev mode', async () => {
    const res = await request(app).post('/api/slack').send({});
    expect(res.status).toBe(200);
    expect(res.body.text).toMatch(/Usage/);
  });

  it('rejects Slack requests without a valid signature when configured', async () => {
    process.env.SLACK_SIGNING_SECRET = 'slack-signing-secret';
    const res = await request(app).post('/api/slack').send({});
    expect(res.status).toBe(401);
  });

  it('accepts a valid Slack signature over the raw form body', async () => {
    process.env.SLACK_SIGNING_SECRET = 'slack-signing-secret';
    const rawBody = 'text=';
    const timestamp = String(Math.floor(Date.now() / 1000));
    const res = await request(app)
      .post('/api/slack')
      .set('Content-Type', 'application/x-www-form-urlencoded')
      .set('x-slack-request-timestamp', timestamp)
      .set('x-slack-signature', slackSignature(process.env.SLACK_SIGNING_SECRET, timestamp, rawBody))
      .send(rawBody);

    expect(res.status).toBe(200);
    expect(res.body.response_type).toBe('ephemeral');
  });

  it('rejects stale Slack signatures', async () => {
    process.env.SLACK_SIGNING_SECRET = 'slack-signing-secret';
    const rawBody = 'text=';
    const timestamp = String(Math.floor(Date.now() / 1000) - 3600);
    const res = await request(app)
      .post('/api/slack')
      .set('Content-Type', 'application/x-www-form-urlencoded')
      .set('x-slack-request-timestamp', timestamp)
      .set('x-slack-signature', slackSignature(process.env.SLACK_SIGNING_SECRET, timestamp, rawBody))
      .send(rawBody);

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/Stale Slack signature/);
  });
});
