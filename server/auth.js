import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import * as db from './db.js';
import { encrypt, decrypt } from './encryption.js';
import { appendAudit } from './db.js';
import { generateSecret, verifyTotp, buildOtpAuthUrl } from './totp.js';

const ACCESS_TTL_SECONDS = 15 * 60;          // 15 min
const REFRESH_TTL_SECONDS = 30 * 24 * 3600;  // 30 days
const COOKIE_NAME = 'fl_session';            // access token cookie
const REFRESH_COOKIE = 'fl_refresh';         // refresh token cookie
const PENDING_2FA_COOKIE = 'fl_2fa_pending'; // short-lived pending-login marker

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;
const RECOVERY_CODE_COUNT = 10;

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (secret && secret.length >= 16) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must be set in production');
  }
  return 'fetchlab-dev-jwt-secret-do-not-use-in-prod';
}

export function signToken(user, { ttl = ACCESS_TTL_SECONDS } = {}) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    getJwtSecret(),
    { expiresIn: ttl }
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

function setAccessCookie(res, token) {
  const secure = process.env.NODE_ENV === 'production';
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    maxAge: ACCESS_TTL_SECONDS * 1000,
    path: '/',
  });
}

function setRefreshCookie(res, refreshToken) {
  const secure = process.env.NODE_ENV === 'production';
  res.cookie(REFRESH_COOKIE, refreshToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    maxAge: REFRESH_TTL_SECONDS * 1000,
    path: '/api/auth',
  });
}

function clearAuthCookies(res) {
  res.clearCookie(COOKIE_NAME, { path: '/' });
  res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
  res.clearCookie(PENDING_2FA_COOKIE, { path: '/api/auth' });
}

function publicUser(u) {
  return { id: u.id, email: u.email, name: u.name, role: u.role, totp_enabled: !!u.totp_enabled };
}

export async function ensurePersonalWorkspace(user) {
  const workspaces = await db.listWorkspacesForUser(user.id);
  if (workspaces.length > 0) return workspaces[0];
  return db.createWorkspace({ name: 'Personal', owner_id: user.id });
}

function hashRefreshToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function generateRefreshToken() {
  return crypto.randomBytes(32).toString('base64url');
}

async function issueSession(user, req, res, { parent_id = null } = {}) {
  const refreshToken = generateRefreshToken();
  const refresh_token_hash = hashRefreshToken(refreshToken);
  const expires_at = new Date(Date.now() + REFRESH_TTL_SECONDS * 1000).toISOString();
  const session = await db.createSession({
    user_id: user.id,
    refresh_token_hash,
    parent_id,
    user_agent: (req.headers['user-agent'] || '').slice(0, 400),
    ip: req.ip,
    expires_at,
  });
  const accessToken = signToken(user);
  setAccessCookie(res, accessToken);
  setRefreshCookie(res, `${session.id}.${refreshToken}`);
  return { accessToken, refreshToken: `${session.id}.${refreshToken}`, session };
}

function generateRecoveryCodes(count = RECOVERY_CODE_COUNT) {
  const codes = [];
  for (let i = 0; i < count; i++) {
    const raw = crypto.randomBytes(5).toString('hex'); // 10 hex chars
    codes.push(`${raw.slice(0, 5)}-${raw.slice(5)}`);
  }
  return codes;
}

async function hashRecoveryCodes(codes) {
  return Promise.all(codes.map(c => bcrypt.hash(c, 10)));
}

async function consumeRecoveryCode(user, candidate) {
  const codes = Array.isArray(user.recovery_codes_hashed) ? user.recovery_codes_hashed : [];
  const normalised = String(candidate || '').trim().toLowerCase();
  if (!normalised) return false;
  for (let i = 0; i < codes.length; i++) {
    if (await bcrypt.compare(normalised, codes[i])) {
      const remaining = codes.slice(0, i).concat(codes.slice(i + 1));
      await db.updateUser(user.id, { recovery_codes_hashed: remaining });
      return true;
    }
  }
  return false;
}

function isUserLocked(user) {
  if (!user.locked_until) return false;
  return new Date(user.locked_until).getTime() > Date.now();
}

async function recordLoginFailure(user, req) {
  const failed = (user.failed_login_count || 0) + 1;
  const fields = { failed_login_count: failed };
  if (failed >= MAX_FAILED_ATTEMPTS) {
    fields.locked_until = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000).toISOString();
    await appendAudit({
      user_id: user.id, action: 'auth.account.locked', target_type: 'user', target_id: user.id,
      detail: { failed_count: failed, lockout_minutes: LOCKOUT_MINUTES }, ip: req.ip,
    });
  }
  await db.updateUser(user.id, fields);
  return failed;
}

async function resetLoginFailures(user) {
  if (!user.failed_login_count && !user.locked_until) return;
  await db.updateUser(user.id, { failed_login_count: 0, locked_until: null });
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
      const { accessToken } = await issueSession(user, req, res);
      await appendAudit({
        user_id: user.id, action: 'auth.register', target_type: 'user', target_id: user.id,
        detail: { email: user.email }, ip: req.ip,
      });
      res.json({ user: publicUser(user), token: accessToken });
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
        if (user) await recordLoginFailure(user, req);
        await appendAudit({ user_id: user?.id || null, action: 'auth.login.failed', detail: { email }, ip: req.ip });
        return res.status(401).json({ error: 'Invalid email or password' });
      }
      if (isUserLocked(user)) {
        await appendAudit({ user_id: user.id, action: 'auth.login.locked', detail: { email }, ip: req.ip });
        return res.status(423).json({
          error: 'Account temporarily locked due to too many failed attempts. Try again later.',
          locked_until: user.locked_until,
        });
      }

      // 2FA gate — issue a short-lived pending cookie that only authorises POST /login/2fa
      if (user.totp_enabled) {
        const pendingPayload = { sub: user.id, type: '2fa_pending' };
        const pendingToken = jwt.sign(pendingPayload, getJwtSecret(), { expiresIn: 5 * 60 });
        res.cookie(PENDING_2FA_COOKIE, pendingToken, {
          httpOnly: true, sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
          maxAge: 5 * 60 * 1000, path: '/api/auth',
        });
        await appendAudit({ user_id: user.id, action: 'auth.login.2fa_required', ip: req.ip });
        return res.json({ twofa_required: true, pending_token: pendingToken });
      }

      await resetLoginFailures(user);
      const { accessToken } = await issueSession(user, req, res);
      await appendAudit({ user_id: user.id, action: 'auth.login', target_type: 'user', target_id: user.id, ip: req.ip });
      res.json({ user: publicUser(user), token: accessToken });
    } catch (err) {
      console.error('login error:', err);
      res.status(500).json({ error: 'Login failed' });
    }
  });

  // Complete a 2FA-gated login by submitting a TOTP code or recovery code
  router.post('/login/2fa', async (req, res) => {
    try {
      const { code, recovery_code, pending_token } = req.body || {};
      const tokenStr = pending_token || req.cookies?.[PENDING_2FA_COOKIE];
      if (!tokenStr) return res.status(401).json({ error: 'No pending 2FA login' });
      const payload = verifyToken(tokenStr);
      if (!payload || payload.type !== '2fa_pending') {
        return res.status(401).json({ error: 'Invalid or expired 2FA pending token' });
      }
      const user = await db.findUserById(payload.sub);
      if (!user) return res.status(401).json({ error: 'User no longer exists' });
      if (isUserLocked(user)) return res.status(423).json({ error: 'Account locked', locked_until: user.locked_until });

      let verified = false;
      let usedRecovery = false;
      if (code && user.totp_secret_enc) {
        const secret = decrypt(user.totp_secret_enc);
        verified = verifyTotp(secret, String(code));
      }
      if (!verified && recovery_code) {
        usedRecovery = await consumeRecoveryCode(user, recovery_code);
        verified = usedRecovery;
      }
      if (!verified) {
        await recordLoginFailure(user, req);
        await appendAudit({ user_id: user.id, action: 'auth.2fa.failed', ip: req.ip });
        return res.status(401).json({ error: 'Invalid 2FA code' });
      }

      await resetLoginFailures(user);
      res.clearCookie(PENDING_2FA_COOKIE, { path: '/api/auth' });
      const { accessToken } = await issueSession(user, req, res);
      await appendAudit({
        user_id: user.id, action: usedRecovery ? 'auth.login.recovery_code' : 'auth.login.2fa',
        target_type: 'user', target_id: user.id, ip: req.ip,
      });
      res.json({ user: publicUser(user), token: accessToken });
    } catch (err) {
      console.error('2fa login error:', err);
      res.status(500).json({ error: '2FA verification failed' });
    }
  });

  router.post('/refresh', async (req, res) => {
    try {
      const raw = req.body?.refresh_token || req.cookies?.[REFRESH_COOKIE];
      if (!raw || typeof raw !== 'string' || !raw.includes('.')) {
        return res.status(401).json({ error: 'Missing refresh token' });
      }
      const dot = raw.indexOf('.');
      const sessionId = raw.slice(0, dot);
      const tokenPart = raw.slice(dot + 1);
      const session = await db.findSessionById(sessionId);
      if (!session) return res.status(401).json({ error: 'Unknown session' });

      const presented = hashRefreshToken(tokenPart);
      const matchesCurrent = session.refresh_token_hash === presented;

      // Reuse detection: presenting a token whose hash is no longer the current
      // one for this session means the legitimate client already rotated and
      // someone else is replaying. Revoke all sessions for the user.
      if (!matchesCurrent) {
        await db.revokeAllUserSessions(session.user_id, { reuseDetected: true });
        await appendAudit({
          user_id: session.user_id, action: 'auth.refresh.reuse_detected',
          target_type: 'session', target_id: session.id, ip: req.ip,
        });
        clearAuthCookies(res);
        return res.status(401).json({ error: 'Refresh token reuse detected — all sessions revoked' });
      }
      // Already-revoked session: just deny, don't escalate (the user may have
      // explicitly logged this device out from another device).
      if (session.revoked_at) {
        clearAuthCookies(res);
        return res.status(401).json({ error: 'Session has been revoked' });
      }
      if (new Date(session.expires_at).getTime() < Date.now()) {
        await db.revokeSession(session.id);
        return res.status(401).json({ error: 'Refresh token expired' });
      }

      const user = await db.findUserById(session.user_id);
      if (!user) return res.status(401).json({ error: 'User no longer exists' });

      // Rotate: replace stored hash with a fresh one
      const newRefresh = generateRefreshToken();
      const newHash = hashRefreshToken(newRefresh);
      await db.rotateSession(session.id, newHash);

      const accessToken = signToken(user);
      setAccessCookie(res, accessToken);
      setRefreshCookie(res, `${session.id}.${newRefresh}`);
      await appendAudit({
        user_id: user.id, action: 'auth.refresh',
        target_type: 'session', target_id: session.id, ip: req.ip,
      });
      res.json({ user: publicUser(user), token: accessToken, refresh_token: `${session.id}.${newRefresh}` });
    } catch (err) {
      console.error('refresh error:', err);
      res.status(500).json({ error: 'Refresh failed' });
    }
  });

  router.post('/logout', async (req, res) => {
    try {
      const raw = req.cookies?.[REFRESH_COOKIE];
      if (raw && raw.includes('.')) {
        const sessionId = raw.slice(0, raw.indexOf('.'));
        const session = await db.findSessionById(sessionId);
        if (session) {
          await db.revokeSession(session.id);
          await appendAudit({
            user_id: session.user_id, action: 'auth.logout',
            target_type: 'session', target_id: session.id, ip: req.ip,
          });
        }
      }
    } catch { /* best-effort */ }
    clearAuthCookies(res);
    res.json({ ok: true });
  });

  router.get('/me', requireAuth, async (req, res) => {
    const user = await db.findUserById(req.user.id);
    const workspaces = await db.listWorkspacesForUser(req.user.id);
    res.json({ user: publicUser(user), workspaces });
  });

  // ---- Sessions ----
  router.get('/sessions', requireAuth, async (req, res) => {
    const sessions = await db.listSessionsForUser(req.user.id);
    const currentRaw = req.cookies?.[REFRESH_COOKIE];
    const currentId = currentRaw && currentRaw.includes('.') ? currentRaw.slice(0, currentRaw.indexOf('.')) : null;
    res.json({
      sessions: sessions.map(s => ({
        id: s.id,
        user_agent: s.user_agent,
        ip: s.ip,
        created_at: s.created_at,
        expires_at: s.expires_at,
        rotated_at: s.rotated_at,
        revoked_at: s.revoked_at,
        reuse_detected: s.reuse_detected,
        is_current: s.id === currentId,
      })),
    });
  });

  router.delete('/sessions/:id', requireAuth, async (req, res) => {
    const session = await db.findSessionById(req.params.id);
    if (!session || session.user_id !== req.user.id) {
      return res.status(404).json({ error: 'Session not found' });
    }
    await db.revokeSession(session.id);
    await appendAudit({
      user_id: req.user.id, action: 'auth.session.revoke',
      target_type: 'session', target_id: session.id, ip: req.ip,
    });
    // If they revoked their current session, clear cookies too
    const currentRaw = req.cookies?.[REFRESH_COOKIE];
    const currentId = currentRaw && currentRaw.includes('.') ? currentRaw.slice(0, currentRaw.indexOf('.')) : null;
    if (currentId === session.id) clearAuthCookies(res);
    res.json({ ok: true });
  });

  router.post('/sessions/revoke-all', requireAuth, async (req, res) => {
    await db.revokeAllUserSessions(req.user.id);
    await appendAudit({
      user_id: req.user.id, action: 'auth.session.revoke_all',
      target_type: 'user', target_id: req.user.id, ip: req.ip,
    });
    clearAuthCookies(res);
    res.json({ ok: true });
  });

  // ---- 2FA / TOTP ----
  router.post('/2fa/setup', requireAuth, async (req, res) => {
    const user = await db.findUserById(req.user.id);
    if (user.totp_enabled) return res.status(400).json({ error: '2FA already enabled. Disable it first.' });
    const secret = generateSecret();
    const issuer = 'FetchLab';
    const otpauth = buildOtpAuthUrl({ issuer, account: user.email, secret });
    // Persist the pending secret encrypted, but DO NOT mark enabled yet.
    await db.updateUser(user.id, { totp_secret_enc: encrypt(secret) });
    res.json({ secret, otpauth_url: otpauth, issuer, account: user.email });
  });

  router.post('/2fa/verify', requireAuth, async (req, res) => {
    const { code } = req.body || {};
    if (!code) return res.status(400).json({ error: 'code is required' });
    const user = await db.findUserById(req.user.id);
    if (!user.totp_secret_enc) return res.status(400).json({ error: 'No pending 2FA setup. Call /2fa/setup first.' });
    const secret = decrypt(user.totp_secret_enc);
    if (!verifyTotp(secret, String(code))) {
      return res.status(401).json({ error: 'Invalid TOTP code' });
    }
    const codes = generateRecoveryCodes();
    const hashed = await hashRecoveryCodes(codes);
    await db.updateUser(user.id, { totp_enabled: true, recovery_codes_hashed: hashed });
    await appendAudit({
      user_id: user.id, action: 'auth.2fa.enabled',
      target_type: 'user', target_id: user.id, ip: req.ip,
    });
    res.json({ enabled: true, recovery_codes: codes });
  });

  router.post('/2fa/disable', requireAuth, async (req, res) => {
    const { password, code } = req.body || {};
    if (!password) return res.status(400).json({ error: 'password is required to disable 2FA' });
    const user = await db.findUserById(req.user.id);
    if (!user.totp_enabled) return res.status(400).json({ error: '2FA is not enabled' });
    if (!user.password_hash || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Incorrect password' });
    }
    if (!code || !verifyTotp(decrypt(user.totp_secret_enc), String(code))) {
      return res.status(401).json({ error: 'Valid TOTP code required to disable 2FA' });
    }
    await db.updateUser(user.id, {
      totp_enabled: false,
      totp_secret_enc: null,
      recovery_codes_hashed: [],
    });
    await appendAudit({
      user_id: user.id, action: 'auth.2fa.disabled',
      target_type: 'user', target_id: user.id, ip: req.ip,
    });
    res.json({ enabled: false });
  });

  router.post('/2fa/recovery-codes/regenerate', requireAuth, async (req, res) => {
    const { password } = req.body || {};
    if (!password) return res.status(400).json({ error: 'password is required' });
    const user = await db.findUserById(req.user.id);
    if (!user.totp_enabled) return res.status(400).json({ error: '2FA is not enabled' });
    if (!user.password_hash || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Incorrect password' });
    }
    const codes = generateRecoveryCodes();
    const hashed = await hashRecoveryCodes(codes);
    await db.updateUser(user.id, { recovery_codes_hashed: hashed });
    await appendAudit({
      user_id: user.id, action: 'auth.2fa.recovery_codes_regenerated',
      target_type: 'user', target_id: user.id, ip: req.ip,
    });
    res.json({ recovery_codes: codes });
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
      let meta = null;
      try {
        const r = await fetch(`${issuer}/.well-known/openid-configuration`);
        if (r.ok) meta = await r.json();
      } catch { /* ignore */ }
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
      const { code, state, error: oidcError } = req.query;
      if (oidcError) return res.status(400).send(`SSO error: ${oidcError}`);
      if (!code || !expected || expected.state !== state) {
        return res.status(400).send('Invalid SSO callback');
      }
      const issuer = cfg.issuer.replace(/\/$/, '');
      let meta = null;
      try {
        const r = await fetch(`${issuer}/.well-known/openid-configuration`);
        if (r.ok) meta = await r.json();
      } catch { /* ignore */ }
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
      if (!tokenRes.ok) {
        const detail = await tokenRes.text().catch(() => '');
        return res.status(400).send(`Token exchange failed: ${tokenRes.status} ${detail.slice(0, 200)}`);
      }
      const tokens = await tokenRes.json();
      const userinfoRes = await fetch(userinfoEndpoint, {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      if (!userinfoRes.ok) {
        return res.status(400).send(`Userinfo fetch failed: ${userinfoRes.status}`);
      }
      const userinfo = await userinfoRes.json();
      const subject = userinfo.sub;
      if (!subject) return res.status(400).send('OIDC userinfo missing "sub"');
      const email = userinfo.email || `${subject}@sso`;
      let user = await db.findUserByOidc(subject);
      if (!user) user = await db.findUserByEmail(email);
      if (!user) {
        user = await db.createUser({
          email, password_hash: null, name: userinfo.name || email,
          role: 'user', oidc_subject: subject,
        });
        await ensurePersonalWorkspace(user);
      } else if (!user.oidc_subject) {
        await db.updateUser(user.id, { oidc_subject: subject });
      }
      await issueSession(user, req, res);
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
