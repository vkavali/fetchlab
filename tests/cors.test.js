import { afterEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { buildApp } from '../server/app.js';

describe('split deployment CORS', () => {
  afterEach(() => {
    delete process.env.FETCHLAB_ALLOWED_ORIGINS;
    delete process.env.CORS_ORIGIN;
  });

  it('allows configured frontend origins to call the API with credentials', async () => {
    process.env.FETCHLAB_ALLOWED_ORIGINS = 'https://frontend.example.com';
    const app = await buildApp({ skipDbInit: true });

    const res = await request(app)
      .options('/api/auth/login')
      .set('Origin', 'https://frontend.example.com')
      .set('Access-Control-Request-Headers', 'Content-Type, Authorization');

    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe('https://frontend.example.com');
    expect(res.headers['access-control-allow-credentials']).toBe('true');
    expect(res.headers['access-control-allow-headers']).toBe('Content-Type, Authorization');
  });

  it('does not reflect unconfigured origins', async () => {
    const app = await buildApp({ skipDbInit: true });

    const res = await request(app)
      .options('/api/auth/login')
      .set('Origin', 'https://evil.example.com');

    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});
