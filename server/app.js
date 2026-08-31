import express from 'express';
import cookieParser from 'cookie-parser';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { initDb } from './db.js';
import { buildAuthRouter, requireAuth, signToken } from './auth.js';
import { encrypt } from './encryption.js';
import { buildWorkspacesRouter } from './workspaces.js';
import { buildAuditRouter } from './audit.js';
import { buildEnterpriseRouter } from './enterprise.js';
import { authLimiter, aiLimiter, apiLimiter } from './rateLimit.js';
import { buildIntegrationsRouter } from './integrations.js';
import { buildAgentRouter } from './agent/routes.js';
import { buildLlmSettingsRouter } from './llmRoutes.js';
import { registerAiRoutes } from '../ai-routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

function assertRuntimeConfig() {
  if (process.env.NODE_ENV !== 'production') return;
  signToken({ id: 'startup-check', email: 'startup@fetchlab.local', role: 'admin' }, { ttl: 1 });
  encrypt('startup-check');
}

export async function buildApp({ skipDbInit = false } = {}) {
  assertRuntimeConfig();
  if (!skipDbInit) await initDb();

  const app = express();
  app.set('trust proxy', 1);
  const captureRawBody = (req, _res, buf) => {
    req.rawBody = buf.toString('utf8');
  };
  app.use(express.json({ limit: '5mb', verify: captureRawBody }));
  app.use(express.urlencoded({ extended: true, limit: '5mb', verify: captureRawBody }));
  app.use(cookieParser());

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', version: '1.1.0', uptime: process.uptime() });
  });

  // Lightweight geo lookup so the marketing pages can localize currency + copy
  // without a heavy client-side dependency. Order of precedence:
  //   1. ?country= override (great for QA, no auth required)
  //   2. Edge/CDN headers (Cloudflare cf-ipcountry, Vercel x-vercel-ip-country)
  //   3. Accept-Language hint (matches -IN / hi-IN as IN)
  //   4. ipapi.co lookup (free tier, soft-fail; cached in memory per IP for 1h)
  //   5. 'US' as the safe default
  const geoCache = new Map(); // ip -> { country, expires }
  app.get('/api/geo', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const override = (req.query?.country || '').toString().trim().toUpperCase();
    if (/^[A-Z]{2}$/.test(override)) {
      return res.json({ country: override, source: 'override' });
    }

    const h = req.headers || {};
    const hdr = (n) => (h[n] || '').toString().trim().toUpperCase();
    const cf = hdr('cf-ipcountry');
    if (/^[A-Z]{2}$/.test(cf) && cf !== 'XX') {
      return res.json({ country: cf, source: 'cloudflare' });
    }
    const vc = hdr('x-vercel-ip-country');
    if (/^[A-Z]{2}$/.test(vc)) {
      return res.json({ country: vc, source: 'vercel' });
    }
    const fly = hdr('fly-client-country') || hdr('x-country');
    if (/^[A-Z]{2}$/.test(fly)) {
      return res.json({ country: fly, source: 'edge' });
    }

    const lang = (h['accept-language'] || '').toString().toLowerCase();
    // Match en-IN, hi-IN, ta-IN, te-IN, kn-IN, mr-IN, gu-IN, bn-IN, pa-IN, ml-IN.
    if (/(^|[,;\s])([a-z]{2}-in)\b/.test(lang)) {
      return res.json({ country: 'IN', source: 'accept-language' });
    }

    // ipapi.co fallback uses req.ip (trust-proxy is set above so this honors X-Forwarded-For).
    // Free tier is 1k/day; soft-fail to 'US' on any error.
    try {
      const ip = (req.ip || '').replace(/^::ffff:/, '');
      if (ip && ip !== '127.0.0.1' && ip !== '::1') {
        const cached = geoCache.get(ip);
        const now = Date.now();
        if (cached && cached.expires > now) {
          return res.json({ country: cached.country, source: 'ipapi-cache' });
        }
        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), 1500);
        const r = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/country/`, {
          signal: controller.signal,
          headers: { 'User-Agent': 'FetchLab/1.2 geo-lookup' },
        }).finally(() => clearTimeout(t));
        if (r.ok) {
          const txt = (await r.text()).trim().toUpperCase();
          if (/^[A-Z]{2}$/.test(txt)) {
            geoCache.set(ip, { country: txt, expires: now + 60 * 60 * 1000 });
            return res.json({ country: txt, source: 'ipapi' });
          }
        }
      }
    } catch { /* fall through to default */ }

    return res.json({ country: 'US', source: 'default' });
  });

  // Public auth (with rate limit on attempts)
  app.use('/api/auth', authLimiter, buildAuthRouter());

  // AI endpoints: auth + AI rate limit, then mount the existing AI route handlers.
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
  app.use('/api/enterprise', apiLimiter, buildEnterpriseRouter());
  app.use('/api/agent', apiLimiter, buildAgentRouter());
  app.use('/api/settings/llm', apiLimiter, buildLlmSettingsRouter());
  app.use('/api', apiLimiter, buildIntegrationsRouter());

  // Serve static SPA. Client-side router in App.tsx maps:
  //   /          -> marketing landing page
  //   /privacy   -> privacy policy
  //   /terms     -> terms of service
  //   /app, *    -> API client app (with auth gate)
  app.use(express.static(join(ROOT, 'dist')));
  app.get('/{*path}', (_req, res) => {
    res.sendFile(join(ROOT, 'dist', 'index.html'));
  });

  return app;
}
