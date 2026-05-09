import express from 'express';
import cookieParser from 'cookie-parser';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { initDb } from './db.js';
import { buildAuthRouter, requireAuth } from './auth.js';
import { buildWorkspacesRouter } from './workspaces.js';
import { buildAuditRouter } from './audit.js';
import { authLimiter, aiLimiter, apiLimiter } from './rateLimit.js';
import { buildIntegrationsRouter } from './integrations.js';
import { registerAiRoutes } from '../ai-routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

export async function buildApp({ skipDbInit = false } = {}) {
  if (!skipDbInit) await initDb();

  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '5mb' }));
  app.use(express.urlencoded({ extended: true, limit: '5mb' }));
  app.use(cookieParser());

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', version: '1.1.0', uptime: process.uptime() });
  });

  // Public auth (with rate limit on attempts)
  app.use('/api/auth', authLimiter, buildAuthRouter());

  // AI endpoints — auth + AI rate limit, then mount the existing AI route handlers
  // /api/ai/status remains accessible without auth so the UI can probe AI availability.
  const aiSubApp = express.Router();
  aiSubApp.use((req, res, next) => {
    if (req.path === '/status' || req.path === '/status/') return next();
    return requireAuth(req, res, next);
  });
  registerAiRoutes({
    post: (path, handler) => aiSubApp.post(path.replace(/^\/api\/ai/, ''), handler),
    get:  (path, handler) => aiSubApp.get(path.replace(/^\/api\/ai/, ''), handler),
  });
  app.use('/api/ai', aiLimiter, aiSubApp);

  // Workspace + audit + integrations
  app.use('/api/workspaces', apiLimiter, buildWorkspacesRouter());
  app.use('/api/audit', apiLimiter, buildAuditRouter());
  app.use('/api', apiLimiter, buildIntegrationsRouter());

  // Serve static SPA
  app.use(express.static(join(ROOT, 'dist')));
  app.get('/{*path}', (_req, res) => {
    res.sendFile(join(ROOT, 'dist', 'index.html'));
  });

  return app;
}
