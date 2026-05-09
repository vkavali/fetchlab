import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import * as db from './db.js';
import { encrypt, decrypt } from './encryption.js';
import { appendAudit } from './db.js';

const TOKEN_TTL = '7d';
const COOKIE_NAME = 'fl_session';

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (secret && secret.length >= 16) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must be set in production');
  }
  return 'fetchlab-dev-jwt-secret-do-not-use-in-prod';
}

export function signToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    getJwtSecret(),
    { expiresIn: TOKEN_TTL }
  );
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, getJwtSecret());
  } catch {
    return null;
  }
}

function extractToken(req) {
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7);
  if (req.cookies && req.cookies[COOKIE_NAME]) return req.cookies[COOKIE_NAME];
  return null;
}

export async function requireAuth(req, res, next) {
  if (process.env.AUTH_DISABLED === '1') {
    req.user = { id: 'local', email: 'local@fetchlab', name: 'Local', role: 'admin' };
    return next();
  }
  const token = extractToken(req);
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  const payload = verifyToken(token);
  if (!payload) return res.status(401).json({ error: 'Invalid or expired token' });
  const user = await db.findUserById(payload.sub);
  if (!user) return res.status(401).json({ error: 'User no longer exists' });
  req.user = { id: user.id, email: user.email, name: user.name, role: user.role };
  next();
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  next();
}

function setSessionCookie(res, token) {
  const secure = process.env.NODE_ENV === 'production';
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    maxAge: 7 * 24 * 3600 * 1000,
    path: '/',
  });
}

function publicUser(u) {
  return { id: u.id, email: u.email, name: u.name, role: u.role };
}

export async function ensurePersonalWorkspace(user) {
  const workspaces = await db.listWorkspacesForUser(user.id);
  if (workspaces.length > 0) return workspaces[0];
  return db.createWorkspace({ name: 'Personal', owner_id: user.id });
}

export function buildAuthRouter() {
  const router = express.Router();

  router.post('/register', async (req, res) => {
    try {
      const { email, password, name } = req.body || {};
      if (!email || !password) return res.status(400).json({ error: 'email and password are required' });
      if (typeof password !== 'string' || password.length < 8) {
        return res.status(400).json({ error: 'password must be at least 8 characters' });
      }
      const existing = await db.findUserByEmail(email);
      if (existing) return res.status(409).json({ error: 'Email already registered' });

      const userCount = (await db.listUsers()).length;
      const role = userCount === 0 ? 'admin' : 'user';

      const password_hash = await bcrypt.hash(password, 10);
      const user = await db.createUser({ email, password_hash, name: name || email.split('@')[0], role });
      await ensurePersonalWorkspace(user);
      const token = signToken(user);
      setSessionCookie(res, token);
      await appendAudit({
        user_id: user.id, action: 'auth.register', target_type: 'user', target_id: user.id,
        detail: { email: user.email }, ip: req.ip,
      });
      res.json({ user: publicUser(user), token });
    } catch (err) {
      console.error('register error:', err);
      res.status(500).json({ error: 'Registration failed' });
    }
  });

  router.post('/login', async (req, res) => {
    try {
      const { email, password } = req.body || {};
      if (!email || !password) return res.status(400).json({ error: 'email and password required' });
      const user = await db.findUserByEmail(email);
      const fakeHash = '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalid';
      const ok = user && user.password_hash
        ? await bcrypt.compare(password, user.password_hash)
        : (await bcrypt.compare(password, fakeHash), false);
      if (!ok || !user) {
        await appendAudit({ user_id: null, action: 'auth.login.failed', detail: { email }, ip: req.ip });
        return res.status(401).json({ error: 'Invalid email or password' });
      }
      const token = signToken(user);
      setSessionCookie(res, token);
      await appendAudit({ user_id: user.id, action: 'auth.login', target_type: 'user', target_id: user.id, ip: req.ip });
      res.json({ user: publicUser(user), token });
    } catch (err) {
      console.error('login error:', err);
      res.status(500).json({ error: 'Login failed' });
    }
  });

  router.post('/logout', (req, res) => {
    res.clearCookie(COOKIE_NAME, { path: '/' });
    res.json({ ok: true });
  });

  router.get('/me', requireAuth, async (req, res) => {
    const workspaces = await db.listWorkspacesForUser(req.user.id);
    res.json({ user: req.user, workspaces });
  });

  // ---- SSO / OIDC ----
  router.get('/sso/configs', async (_req, res) => {
    const configs = await db.listOidcConfigs();
    res.json({ configs: configs.map(c => ({ id: c.id, name: c.name })) });
  });

  router.get('/sso/start/:configId', async (req, res) => {
    try {
      const cfg = await db.getOidcConfig(req.params.configId);
      if (!cfg) return res.status(404).json({ error: 'OIDC config not found' });
      const issuer = cfg.issuer.replace(/\/$/, '');
      const meta = await fetch(`${issuer}/.well-known/openid-configuration`).then(r => r.json()).catch(() => null);
      const authEndpoint = meta?.authorization_endpoint || `${issuer}/authorize`;
      const state = crypto.randomBytes(16).toString('hex');
      const nonce = crypto.randomBytes(16).toString('hex');
      const redirect = cfg.redirect_uri || `${req.protocol}://${req.get('host')}/api/auth/sso/callback/${cfg.id}`;
      const params = new URLSearchParams({
        response_type: 'code',
        client_id: cfg.client_id,
        redirect_uri: redirect,
        scope: cfg.scopes || 'openid profile email',
        state, nonce,
      });
      // store state in short-lived cookie
      res.cookie(`fl_oidc_${cfg.id}`, JSON.stringify({ state, nonce }), {
        httpOnly: true, sameSite: 'lax', maxAge: 10 * 60 * 1000, path: '/',
      });
      res.redirect(`${authEndpoint}?${params.toString()}`);
    } catch (err) {
      console.error('sso start error:', err);
      res.status(500).json({ error: 'SSO start failed' });
    }
  });

  router.get('/sso/callback/:configId', async (req, res) => {
    try {
      const cfg = await db.getOidcConfig(req.params.configId);
      if (!cfg) return res.status(404).send('OIDC config not found');
      const cookieRaw = req.cookies?.[`fl_oidc_${cfg.id}`];
      const expected = cookieRaw ? JSON.parse(cookieRaw) : null;
      const { code, state } = req.query;
      if (!code || !expected || expected.state !== state) {
        return res.status(400).send('Invalid SSO callback');
      }
      const issuer = cfg.issuer.replace(/\/$/, '');
      const meta = await fetch(`${issuer}/.well-known/openid-configuration`).then(r => r.json()).catch(() => null);
      const tokenEndpoint = meta?.token_endpoint || `${issuer}/oauth/token`;
      const userinfoEndpoint = meta?.userinfo_endpoint || `${issuer}/userinfo`;
      const redirect = cfg.redirect_uri || `${req.protocol}://${req.get('host')}/api/auth/sso/callback/${cfg.id}`;
      const clientSecret = cfg.client_secret_enc ? decrypt(cfg.client_secret_enc) : '';
      const tokenRes = await fetch(tokenEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: String(code),
          redirect_uri: redirect,
          client_id: cfg.client_id,
          client_secret: clientSecret,
        }),
      });
      if (!tokenRes.ok) return res.status(400).send('Token exchange failed');
      const tokens = await tokenRes.json();
      const userinfo = await fetch(userinfoEndpoint, {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      }).then(r => r.json());
      const subject = userinfo.sub;
      const email = userinfo.email || `${subject}@sso`;
      let user = await db.findUserByOidc(subject);
      if (!user) user = await db.findUserByEmail(email);
      if (!user) {
        user = await db.createUser({
          email, password_hash: null, name: userinfo.name || email,
          role: 'user', oidc_subject: subject,
        });
        await ensurePersonalWorkspace(user);
      }
      const sessionToken = signToken(user);
      setSessionCookie(res, sessionToken);
      res.clearCookie(`fl_oidc_${cfg.id}`, { path: '/' });
      await appendAudit({ user_id: user.id, action: 'auth.sso.login', target_type: 'user', target_id: user.id, ip: req.ip });
      res.redirect('/');
    } catch (err) {
      console.error('sso callback error:', err);
      res.status(500).send('SSO callback failed');
    }
  });

  // Admin: manage OIDC configs
  router.get('/sso/admin', requireAuth, requireAdmin, async (_req, res) => {
    const configs = await db.listOidcConfigs();
    res.json({ configs });
  });

  router.post('/sso/admin', requireAuth, requireAdmin, async (req, res) => {
    const { id, name, issuer, client_id, client_secret, redirect_uri, scopes } = req.body || {};
    if (!name || !issuer || !client_id) return res.status(400).json({ error: 'name, issuer, client_id required' });
    const client_secret_enc = client_secret ? encrypt(client_secret) : null;
    const result = await db.upsertOidcConfig({ id, name, issuer, client_id, client_secret_enc, redirect_uri, scopes });
    await appendAudit({ user_id: req.user.id, action: 'sso.config.upsert', target_type: 'oidc_config', target_id: result.id, ip: req.ip });
    res.json(result);
  });

  router.delete('/sso/admin/:id', requireAuth, requireAdmin, async (req, res) => {
    await db.deleteOidcConfig(req.params.id);
    await appendAudit({ user_id: req.user.id, action: 'sso.config.delete', target_type: 'oidc_config', target_id: req.params.id, ip: req.ip });
    res.json({ ok: true });
  });

  return router;
}
