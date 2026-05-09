import express from 'express';
import cookieParser from 'cookie-parser';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { initDb } from './db.js';
import { buildAuthRouter } from './auth.js';
import { buildWorkspacesRouter } from './workspaces.js';
import { buildAuditRouter } from './audit.js';
import { buildAiRouter } from './ai.js';
import { authLimiter, aiLimiter, apiLimiter } from './rateLimit.js';
import { buildIntegrationsRouter } from './integrations.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

export async function buildApp({ skipDbInit = false } = {}) {
  if (!skipDbInit) await initDb();

  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '4mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', version: '1.1.0', uptime: process.uptime() });
  });

  // Public auth (with rate limit on attempts)
  app.use('/api/auth', authLimiter, buildAuthRouter());

  // AI endpoints — auth + AI rate limit
  app.use('/api/ai', aiLimiter, buildAiRouter());

  // Workspace + audit + integrations — general API limit + auth (auth applied inside routers)
  app.use('/api/workspaces', apiLimiter, buildWorkspacesRouter());
  app.use('/api/audit', apiLimiter, buildAuditRouter());

  // Slack/Teams/Widget integrations — these are external webhooks, no auth required, but rate limited
  app.use('/api', apiLimiter, buildIntegrationsRouter());

  // Serve static SPA
  app.use(express.static(join(ROOT, 'dist')));
  app.get('/{*path}', (_req, res) => {
    res.sendFile(join(ROOT, 'dist', 'index.html'));
  });

  return app;
}
