import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildApp } from '../server/app.js';

describe('production SPA routes', () => {
  let app;
  let staticRoot;

  beforeAll(async () => {
    staticRoot = await mkdtemp(join(tmpdir(), 'fetchlab-static-'));
    await writeFile(join(staticRoot, 'index.html'), '<!doctype html><title>FetchLab route fixture</title>');
    app = await buildApp({ skipDbInit: true, staticRoot });
  });

  afterAll(async () => {
    await rm(staticRoot, { recursive: true, force: true });
  });

  for (const path of ['/', '/app', '/enterprise', '/how-to']) {
    it(`serves the SPA entry point for ${path}`, async () => {
      const response = await request(app).get(path);
      expect(response.status).toBe(200);
      expect(response.text).toContain('FetchLab route fixture');
    });
  }
});
