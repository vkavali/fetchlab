import express from 'express';
import crypto from 'crypto';
import * as db from './db.js';
import { requireAuth, requireAdmin, ensurePersonalWorkspace } from './auth.js';

const SCIM_USER_SCHEMA = 'urn:ietf:params:scim:schemas:core:2.0:User';
const SCIM_LIST_SCHEMA = 'urn:ietf:params:scim:api:messages:2.0:ListResponse';
const SCIM_ERROR_SCHEMA = 'urn:ietf:params:scim:api:messages:2.0:Error';
const EVIDENCE_STATUSES = new Set(['needed', 'in_progress', 'collected', 'accepted', 'rejected']);

const SOC2_CONTROLS = [
  {
    id: 'CC6.1',
    title: 'Logical access is restricted to authorized users',
    evidence: ['RBAC role matrix', 'Admin user change audit events', 'Disabled user access test'],
  },
  {
    id: 'CC6.6',
    title: 'Access is removed when no longer required',
    evidence: ['SCIM deprovision event', 'Disabled account login rejection', 'Session revocation evidence'],
  },
  {
    id: 'CC7.2',
    title: 'Security events are monitored and retained',
    evidence: ['Audit log export', 'Retention run report', 'Incident/agent action records'],
  },
  {
    id: 'A1.2',
    title: 'Availability and recovery procedures are documented',
    evidence: ['Health endpoint checks', 'Backup/restore runbook', 'Dependency uptime record'],
  },
  {
    id: 'C1.1',
    title: 'Confidential data is protected',
    evidence: ['Encrypted secret storage test', 'BYOK configuration', 'Data retention policy'],
  },
];

function scimError(res, status, detail) {
  return res.status(status).json({
    schemas: [SCIM_ERROR_SCHEMA],
    detail,
    status: String(status),
  });
}

function scimTokenConfigured() {
  return process.env.SCIM_BEARER_TOKEN || process.env.FETCHLAB_SCIM_TOKEN || '';
}

function safeTokenEqual(presented, expected) {
  const a = Buffer.from(String(presented || ''));
  const b = Buffer.from(String(expected || ''));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function requireScim(req, res, next) {
  const settings = await db.getEnterpriseSettings();
  if (!settings.scim_enabled) return scimError(res, 403, 'SCIM is disabled');

  const expected = scimTokenConfigured();
  if (!expected) return scimError(res, 503, 'SCIM token is not configured');

  const auth = req.headers.authorization || '';
  const presented = auth.replace(/^Bearer\s+/i, '');
  if (!safeTokenEqual(presented, expected)) return scimError(res, 401, 'Invalid SCIM bearer token');
  return next();
}

function getScimEmail(body) {
  if (body?.userName) return String(body.userName).trim().toLowerCase();
  const primary = Array.isArray(body?.emails) ? body.emails.find(e => e?.primary) || body.emails[0] : null;
  return primary?.value ? String(primary.value).trim().toLowerCase() : '';
}

function getScimName(body, fallbackEmail) {
  if (body?.displayName) return String(body.displayName);
  if (body?.name?.formatted) return String(body.name.formatted);
  const first = body?.name?.givenName || '';
  const last = body?.name?.familyName || '';
  const full = `${first} ${last}`.trim();
  return full || fallbackEmail;
}

function toScimUser(user) {
  return {
    schemas: [SCIM_USER_SCHEMA],
    id: user.id,
    userName: user.email,
    name: { formatted: user.name || user.email },
    displayName: user.name || user.email,
    active: !user.disabled_at,
    emails: [{ value: user.email, primary: true }],
    meta: {
      resourceType: 'User',
      created: user.created_at,
      lastModified: user.updated_at || user.created_at,
    },
  };
}

function parseUserNameFilter(filter) {
  const match = String(filter || '').match(/^userName\s+eq\s+"([^"]+)"$/i);
  return match ? match[1].trim().toLowerCase() : null;
}

function parsePositiveInt(value, fallback, max = 1000) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(n, max);
}

async function findUserOr404(req, res) {
  const user = await db.findUserById(req.params.id);
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return null;
  }
  return user;
}

async function canDisableOrDemoteAdmin(targetUser, actorId) {
  if (targetUser.id === actorId) return { ok: false, error: 'Admins cannot disable or demote their own account' };
  const users = await db.listUsers();
  const activeAdmins = users.filter(u => u.role === 'admin' && !u.disabled_at);
  if (targetUser.role === 'admin' && activeAdmins.length <= 1) {
    return { ok: false, error: 'Cannot disable or demote the last active admin' };
  }
  return { ok: true };
}

function readinessControlStatus({ key, implemented, configured = null, notes = [] }) {
  return { key, implemented, configured, notes };
}

export function buildEnterpriseRouter() {
  const router = express.Router();

  router.get('/scim/v2/ServiceProviderConfig', requireScim, (_req, res) => {
    res.json({
      schemas: ['urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig'],
      patch: { supported: true },
      bulk: { supported: false, maxOperations: 0, maxPayloadSize: 0 },
      filter: { supported: true, maxResults: 1000 },
      changePassword: { supported: false },
      sort: { supported: false },
      etag: { supported: false },
      authenticationSchemes: [{
        type: 'oauthbearertoken',
        name: 'Bearer Token',
        description: 'Static bearer token configured with SCIM_BEARER_TOKEN or FETCHLAB_SCIM_TOKEN.',
      }],
    });
  });

  router.get('/scim/v2/Users', requireScim, async (req, res) => {
    const users = await db.listUsers();
    const filteredEmail = parseUserNameFilter(req.query.filter);
    const filtered = filteredEmail ? users.filter(u => u.email === filteredEmail) : users;
    const startIndex = parsePositiveInt(req.query.startIndex, 1);
    const count = parsePositiveInt(req.query.count, 100);
    const page = filtered.slice(startIndex - 1, startIndex - 1 + count);
    res.json({
      schemas: [SCIM_LIST_SCHEMA],
      totalResults: filtered.length,
      startIndex,
      itemsPerPage: page.length,
      Resources: page.map(toScimUser),
    });
  });

  router.post('/scim/v2/Users', requireScim, async (req, res) => {
    const email = getScimEmail(req.body);
    if (!email) return scimError(res, 400, 'userName or primary email is required');
    const existing = await db.findUserByEmail(email);
    if (existing) return scimError(res, 409, 'User already exists');

    const user = await db.createUser({
      email,
      password_hash: null,
      name: getScimName(req.body, email),
      role: 'user',
    });
    await ensurePersonalWorkspace(user);
    await db.appendAudit({
      user_id: null,
      action: 'scim.user.create',
      target_type: 'user',
      target_id: user.id,
      detail: { email },
      ip: req.ip,
    });
    return res.status(201).json(toScimUser(user));
  });

  router.get('/scim/v2/Users/:id', requireScim, async (req, res) => {
    const user = await db.findUserById(req.params.id);
    if (!user) return scimError(res, 404, 'User not found');
    return res.json(toScimUser(user));
  });

  async function updateScimUser(req, res) {
    const user = await db.findUserById(req.params.id);
    if (!user) return scimError(res, 404, 'User not found');

    const fields = {};
    if (req.body?.active !== undefined) fields.disabled_at = req.body.active ? null : new Date().toISOString();
    const name = getScimName(req.body, user.email);
    if (name && name !== user.email) fields.name = name;

    if (Object.prototype.hasOwnProperty.call(fields, 'disabled_at') && fields.disabled_at) {
      const allowed = await canDisableOrDemoteAdmin(user, null);
      if (!allowed.ok) return scimError(res, 400, allowed.error);
    }

    const updated = await db.updateUser(user.id, fields);
    await db.appendAudit({
      user_id: null,
      action: 'scim.user.update',
      target_type: 'user',
      target_id: user.id,
      detail: { active: !updated.disabled_at },
      ip: req.ip,
    });
    return res.json(toScimUser(updated));
  }

  router.put('/scim/v2/Users/:id', requireScim, updateScimUser);

  router.patch('/scim/v2/Users/:id', requireScim, async (req, res) => {
    const user = await db.findUserById(req.params.id);
    if (!user) return scimError(res, 404, 'User not found');
    const operations = Array.isArray(req.body?.Operations) ? req.body.Operations : [];
    const fields = {};

    for (const op of operations) {
      const path = String(op.path || '').toLowerCase();
      if (path === 'active') fields.disabled_at = op.value ? null : new Date().toISOString();
      if (path === 'displayname' || path === 'name.formatted') fields.name = String(op.value || user.name || user.email);
    }

    if (Object.prototype.hasOwnProperty.call(fields, 'disabled_at') && fields.disabled_at) {
      const allowed = await canDisableOrDemoteAdmin(user, null);
      if (!allowed.ok) return scimError(res, 400, allowed.error);
    }

    const updated = await db.updateUser(user.id, fields);
    await db.appendAudit({
      user_id: null,
      action: 'scim.user.patch',
      target_type: 'user',
      target_id: user.id,
      detail: { operations: operations.map(op => op.path || 'unknown') },
      ip: req.ip,
    });
    return res.json(toScimUser(updated));
  });

  router.delete('/scim/v2/Users/:id', requireScim, async (req, res) => {
    const user = await db.findUserById(req.params.id);
    if (!user) return scimError(res, 404, 'User not found');
    const allowed = await canDisableOrDemoteAdmin(user, null);
    if (!allowed.ok) return scimError(res, 400, allowed.error);
    await db.updateUser(user.id, { disabled_at: new Date().toISOString() });
    await db.appendAudit({
      user_id: null,
      action: 'scim.user.disable',
      target_type: 'user',
      target_id: user.id,
      detail: { email: user.email },
      ip: req.ip,
    });
    return res.status(204).send();
  });

  router.use(requireAuth, requireAdmin);

  router.get('/readiness', async (_req, res) => {
    const settings = await db.getEnterpriseSettings();
    const oidcConfigs = await db.listOidcConfigs();
    const evidence = await db.listSoc2Evidence();
    const scimToken = !!scimTokenConfigured();
    const controls = [
      readinessControlStatus({
        key: 'audit_logs',
        implemented: true,
        configured: true,
        notes: ['Admin-only audit endpoint is available at /api/audit', 'Retention can purge old audit entries by policy'],
      }),
      readinessControlStatus({
        key: 'rbac_admin_controls',
        implemented: true,
        configured: true,
        notes: ['Global admin/user roles are enforced', 'Workspace admin/member/viewer roles are enforced', 'Admins can disable users and change roles'],
      }),
      readinessControlStatus({
        key: 'sso_oidc',
        implemented: true,
        configured: oidcConfigs.length > 0,
        notes: ['OIDC SSO is available', settings.sso_required ? 'Password login is blocked when OIDC is configured' : 'SSO is not required by policy'],
      }),
      readinessControlStatus({
        key: 'scim',
        implemented: true,
        configured: settings.scim_enabled && scimToken,
        notes: ['SCIM v2 user create/list/update/disable endpoints are available', 'Requires scim_enabled=true and SCIM_BEARER_TOKEN'],
      }),
      readinessControlStatus({
        key: 'retention_policy',
        implemented: true,
        configured: true,
        notes: [`Data retention: ${settings.data_retention_days} days`, `Audit retention: ${settings.audit_retention_days} days`],
      }),
      readinessControlStatus({
        key: 'soc2_evidence_workflow',
        implemented: true,
        configured: evidence.length > 0,
        notes: ['Evidence items can be collected and tracked', 'SOC 2 certification still requires an external audit'],
      }),
    ];

    res.json({
      enterprise_backend_baseline: controls.every(c => c.implemented),
      production_enterprise_ready: false,
      soc2_certified: false,
      reason: 'Backend controls are implemented, but production enterprise readiness still requires configured IdP/SCIM, operating evidence, penetration testing, and a completed SOC 2 audit.',
      controls,
    });
  });

  router.get('/settings', async (_req, res) => {
    res.json({ settings: await db.getEnterpriseSettings() });
  });

  router.put('/settings', async (req, res) => {
    try {
      const settings = await db.updateEnterpriseSettings(req.body || {});
      await db.appendAudit({
        user_id: req.user.id,
        action: 'enterprise.settings.update',
        target_type: 'enterprise_settings',
        target_id: 'default',
        detail: { fields: Object.keys(req.body || {}) },
        ip: req.ip,
      });
      res.json({ settings });
    } catch (err) {
      res.status(400).json({ error: err.message || 'Invalid enterprise settings' });
    }
  });

  router.post('/retention/run', async (req, res) => {
    const settings = await db.getEnterpriseSettings();
    const result = await db.runEnterpriseRetention(settings);
    await db.appendAudit({
      user_id: req.user.id,
      action: 'enterprise.retention.run',
      target_type: 'enterprise_settings',
      target_id: 'default',
      detail: result,
      ip: req.ip,
    });
    res.json({ ok: true, ...result });
  });

  router.get('/sso/status', async (_req, res) => {
    const settings = await db.getEnterpriseSettings();
    const configs = await db.listOidcConfigs();
    res.json({
      implemented: true,
      configured: configs.length > 0,
      required: settings.sso_required,
      password_login_blocked: settings.sso_required && configs.length > 0,
      providers: configs.map(c => ({ id: c.id, name: c.name, issuer: c.issuer })),
    });
  });

  router.get('/scim/status', async (_req, res) => {
    const settings = await db.getEnterpriseSettings();
    res.json({
      implemented: true,
      enabled: settings.scim_enabled,
      token_configured: !!scimTokenConfigured(),
      configured: settings.scim_enabled && !!scimTokenConfigured(),
      base_path: '/api/enterprise/scim/v2',
      resources: ['Users'],
    });
  });

  router.get('/users', async (_req, res) => {
    const users = await db.listUsers();
    res.json({ users });
  });

  router.patch('/users/:id', async (req, res) => {
    const user = await findUserOr404(req, res);
    if (!user) return;

    const fields = {};
    if (req.body?.role !== undefined) {
      if (!['admin', 'user'].includes(req.body.role)) return res.status(400).json({ error: 'role must be admin or user' });
      fields.role = req.body.role;
    }
    if (req.body?.disabled !== undefined) fields.disabled_at = req.body.disabled ? new Date().toISOString() : null;
    if (req.body?.name !== undefined) fields.name = String(req.body.name || user.name || user.email);

    const disables = Object.prototype.hasOwnProperty.call(fields, 'disabled_at') && fields.disabled_at;
    const demotes = fields.role && fields.role !== 'admin' && user.role === 'admin';
    if (disables || demotes) {
      const allowed = await canDisableOrDemoteAdmin(user, req.user.id);
      if (!allowed.ok) return res.status(400).json({ error: allowed.error });
    }

    const updated = await db.updateUser(user.id, fields);
    await db.appendAudit({
      user_id: req.user.id,
      action: 'enterprise.user.update',
      target_type: 'user',
      target_id: user.id,
      detail: { fields: Object.keys(fields) },
      ip: req.ip,
    });
    res.json({ user: updated });
  });

  router.get('/soc2/evidence', async (req, res) => {
    const status = EVIDENCE_STATUSES.has(req.query.status) ? req.query.status : undefined;
    const evidence = await db.listSoc2Evidence({ status });
    res.json({
      certified: false,
      framework: 'SOC 2',
      controls: SOC2_CONTROLS,
      evidence,
      note: 'This tracks evidence readiness. It is not a SOC 2 certification report.',
    });
  });

  router.post('/soc2/evidence', async (req, res) => {
    const { id, control_id, title, owner, status = 'needed', detail, due_at, collected_at } = req.body || {};
    if (!control_id || !title) return res.status(400).json({ error: 'control_id and title are required' });
    if (!EVIDENCE_STATUSES.has(status)) return res.status(400).json({ error: 'invalid evidence status' });
    const evidence = await db.upsertSoc2Evidence({ id, control_id, title, owner, status, detail, due_at, collected_at });
    await db.appendAudit({
      user_id: req.user.id,
      action: 'soc2.evidence.upsert',
      target_type: 'soc2_evidence',
      target_id: evidence.id,
      detail: { control_id, status },
      ip: req.ip,
    });
    res.json({ evidence });
  });

  router.delete('/soc2/evidence/:id', async (req, res) => {
    await db.deleteSoc2Evidence(req.params.id);
    await db.appendAudit({
      user_id: req.user.id,
      action: 'soc2.evidence.delete',
      target_type: 'soc2_evidence',
      target_id: req.params.id,
      ip: req.ip,
    });
    res.json({ ok: true });
  });

  return router;
}
