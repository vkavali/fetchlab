import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';

let pgPool = null;
let mode = 'memory';
let memStore = null;
let filePath = null;

function newId() {
  return crypto.randomUUID();
}

function freshMemStore() {
  return {
    users: [],
    workspaces: [],
    workspace_members: [],
    collections: [],
    requests: [],
    environments: [],
    history: [],
    api_tokens: [],
    audit_log: [],
    oidc_configs: [],
    autonomy_studies: [],
    sessions: [],
    login_attempts: [],
    agent_issues: [],
    agent_actions: [],
    agent_config: [],
    llm_configs: [],
    enterprise_settings: [],
    soc2_evidence: [],
  };
}

async function loadFile() {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    memStore = { ...freshMemStore(), ...parsed };
  } catch (err) {
    if (err.code === 'ENOENT') {
      memStore = freshMemStore();
      await persistFile();
    } else {
      throw err;
    }
  }
}

let persistTimer = null;
async function persistFile() {
  if (mode !== 'file' || !filePath) return;
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(async () => {
    try {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, JSON.stringify(memStore, null, 2), 'utf8');
    } catch (err) {
      console.error('[db] persist error:', err.message);
    }
  }, 200);
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  name TEXT,
  role TEXT NOT NULL DEFAULT 'user',
  oidc_subject TEXT,
  disabled_at TIMESTAMPTZ,
  totp_secret_enc TEXT,
  totp_enabled BOOLEAN NOT NULL DEFAULT false,
  recovery_codes_hashed JSONB NOT NULL DEFAULT '[]'::jsonb,
  failed_login_count INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token_hash TEXT NOT NULL,
  parent_id UUID,
  user_agent TEXT,
  ip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  rotated_at TIMESTAMPTZ,
  reuse_detected BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(refresh_token_hash);

CREATE TABLE IF NOT EXISTS workspaces (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workspace_members (
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (workspace_id, user_id)
);

CREATE TABLE IF NOT EXISTS collections (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS requests (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  collection_id UUID REFERENCES collections(id) ON DELETE SET NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS environments (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS history (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS api_tokens (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS autonomy_studies (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  detail JSONB,
  ip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS oidc_configs (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  issuer TEXT NOT NULL,
  client_id TEXT NOT NULL,
  client_secret_enc TEXT,
  redirect_uri TEXT,
  scopes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_issues (
  id UUID PRIMARY KEY,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  channel_type TEXT NOT NULL DEFAULT 'slack',
  channel_id TEXT,
  channel_name TEXT,
  thread_ts TEXT,
  user_id TEXT,
  message_text TEXT NOT NULL,
  endpoint TEXT,
  method TEXT,
  error_code INTEGER,
  status TEXT NOT NULL DEFAULT 'detected',
  diagnosis JSONB,
  fix JSONB,
  test_result JSONB,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_actions (
  id UUID PRIMARY KEY,
  issue_id UUID REFERENCES agent_issues(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  result JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_config (
  id UUID PRIMARY KEY,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  channel_type TEXT NOT NULL DEFAULT 'slack',
  channel_id TEXT NOT NULL,
  channel_name TEXT,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  sensitivity TEXT NOT NULL DEFAULT 'medium',
  auto_fix BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS llm_configs (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  api_key_enc TEXT,
  base_url TEXT,
  model_id TEXT,
  region TEXT,
  project_id TEXT,
  location TEXT,
  extra_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS enterprise_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  data_retention_days INTEGER NOT NULL DEFAULT 365,
  audit_retention_days INTEGER NOT NULL DEFAULT 365,
  soc2_evidence_retention_days INTEGER NOT NULL DEFAULT 730,
  sso_required BOOLEAN NOT NULL DEFAULT false,
  scim_enabled BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO enterprise_settings (id) VALUES ('default') ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS soc2_evidence (
  id UUID PRIMARY KEY,
  control_id TEXT NOT NULL,
  title TEXT NOT NULL,
  owner TEXT,
  status TEXT NOT NULL DEFAULT 'needed',
  detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  due_at TIMESTAMPTZ,
  collected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Idempotent migrations for existing PostgreSQL installs. CREATE TABLE IF NOT EXISTS
-- does not add columns to tables that already exist, so every column used by
-- auth/session code must be explicitly backfilled here.
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user';
ALTER TABLE users ADD COLUMN IF NOT EXISTS oidc_subject TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS disabled_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_secret_enc TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS recovery_codes_hashed JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_audit_log_workspace ON audit_log(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_collections_workspace ON collections(workspace_id);
CREATE INDEX IF NOT EXISTS idx_autonomy_studies_workspace ON autonomy_studies(workspace_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_history_workspace ON history(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_issues_workspace ON agent_issues(workspace_id, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_issues_status ON agent_issues(status);
CREATE INDEX IF NOT EXISTS idx_agent_actions_issue ON agent_actions(issue_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_config_channel ON agent_config(channel_type, channel_id);
CREATE INDEX IF NOT EXISTS idx_soc2_evidence_control ON soc2_evidence(control_id, status);
`;

export async function initDb() {
  if (process.env.DATABASE_URL) {
    const pgMod = await import('pg');
    const { Pool } = pgMod.default ?? pgMod;
    pgPool = new Pool({ connectionString: process.env.DATABASE_URL });
    await pgPool.query(SCHEMA);
    mode = 'pg';
    console.log('[db] using PostgreSQL');
  } else if (process.env.FETCHLAB_DATA_FILE) {
    filePath = path.resolve(process.env.FETCHLAB_DATA_FILE);
    await loadFile();
    mode = 'file';
    console.log(`[db] using file storage at ${filePath}`);
  } else {
    memStore = freshMemStore();
    mode = 'memory';
    console.log('[db] using in-memory storage (no DATABASE_URL or FETCHLAB_DATA_FILE)');
  }
}

export function getMode() {
  return mode;
}

export async function closeDb() {
  if (pgPool) await pgPool.end();
  if (persistTimer) {
    clearTimeout(persistTimer);
    if (mode === 'file') {
      try {
        await fs.writeFile(filePath, JSON.stringify(memStore, null, 2), 'utf8');
      } catch { /* ignore */ }
    }
  }
}

async function pgQuery(text, params) {
  return pgPool.query(text, params);
}

function memCollection(name) {
  if (!memStore[name]) memStore[name] = [];
  return memStore[name];
}

// ============ Users ============
export async function createUser({ email, password_hash, name, role = 'user', oidc_subject = null }) {
  const id = newId();
  const created_at = new Date().toISOString();
  const user = { id, email: email.toLowerCase(), password_hash, name, role, oidc_subject, disabled_at: null, created_at };
  if (mode === 'pg') {
    await pgQuery(
      `INSERT INTO users (id, email, password_hash, name, role, oidc_subject, disabled_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [id, user.email, password_hash, name, role, oidc_subject, null, created_at]
    );
  } else {
    memCollection('users').push(user);
    await persistFile();
  }
  return user;
}

export async function findUserByEmail(email) {
  const lc = (email || '').toLowerCase();
  if (mode === 'pg') {
    const { rows } = await pgQuery(`SELECT * FROM users WHERE email = $1`, [lc]);
    return rows[0] || null;
  }
  return memCollection('users').find(u => u.email === lc) || null;
}

export async function findUserById(id) {
  if (mode === 'pg') {
    const { rows } = await pgQuery(`SELECT * FROM users WHERE id = $1`, [id]);
    return rows[0] || null;
  }
  return memCollection('users').find(u => u.id === id) || null;
}

export async function findUserByOidc(subject) {
  if (mode === 'pg') {
    const { rows } = await pgQuery(`SELECT * FROM users WHERE oidc_subject = $1`, [subject]);
    return rows[0] || null;
  }
  return memCollection('users').find(u => u.oidc_subject === subject) || null;
}

export async function listUsers() {
  if (mode === 'pg') {
    const { rows } = await pgQuery(`SELECT id, email, name, role, disabled_at, created_at FROM users ORDER BY created_at`);
    return rows;
  }
  return memCollection('users').map(u => ({ id: u.id, email: u.email, name: u.name, role: u.role, disabled_at: u.disabled_at || null, created_at: u.created_at }));
}

export async function updateUser(id, fields) {
  if (mode === 'pg') {
    const cols = [];
    const vals = [];
    let i = 1;
    for (const [k, v] of Object.entries(fields)) {
      cols.push(`${k} = $${i++}`);
      vals.push(v);
    }
    if (!cols.length) return findUserById(id);
    vals.push(id);
    const { rows } = await pgQuery(`UPDATE users SET ${cols.join(', ')} WHERE id = $${i} RETURNING *`, vals);
    return rows[0] || null;
  }
  const u = memCollection('users').find(x => x.id === id);
  if (!u) return null;
  Object.assign(u, fields);
  await persistFile();
  return u;
}

// ============ Sessions (refresh tokens) ============
export async function createSession({ user_id, refresh_token_hash, parent_id = null, user_agent = null, ip = null, expires_at }) {
  const id = newId();
  const created_at = new Date().toISOString();
  const row = {
    id, user_id, refresh_token_hash, parent_id,
    user_agent, ip, created_at, expires_at,
    revoked_at: null, rotated_at: null, reuse_detected: false,
  };
  if (mode === 'pg') {
    await pgQuery(
      `INSERT INTO sessions (id, user_id, refresh_token_hash, parent_id, user_agent, ip, created_at, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [id, user_id, refresh_token_hash, parent_id, user_agent, ip, created_at, expires_at]
    );
  } else {
    memCollection('sessions').push(row);
    await persistFile();
  }
  return row;
}

export async function findSessionByTokenHash(hash) {
  if (mode === 'pg') {
    const { rows } = await pgQuery(`SELECT * FROM sessions WHERE refresh_token_hash = $1`, [hash]);
    return rows[0] || null;
  }
  return memCollection('sessions').find(s => s.refresh_token_hash === hash) || null;
}

export async function findSessionById(id) {
  if (mode === 'pg') {
    const { rows } = await pgQuery(`SELECT * FROM sessions WHERE id = $1`, [id]);
    return rows[0] || null;
  }
  return memCollection('sessions').find(s => s.id === id) || null;
}

export async function listSessionsForUser(userId, { activeOnly = false } = {}) {
  if (mode === 'pg') {
    if (activeOnly) {
      const { rows } = await pgQuery(
        `SELECT * FROM sessions WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > NOW() ORDER BY created_at DESC`,
        [userId]
      );
      return rows;
    }
    const { rows } = await pgQuery(
      `SELECT * FROM sessions WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId]
    );
    return rows;
  }
  let rows = memCollection('sessions').filter(s => s.user_id === userId);
  if (activeOnly) {
    const now = new Date().toISOString();
    rows = rows.filter(s => !s.revoked_at && s.expires_at > now);
  }
  return [...rows].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}

export async function rotateSession(sessionId, newHash) {
  const now = new Date().toISOString();
  if (mode === 'pg') {
    await pgQuery(
      `UPDATE sessions SET rotated_at = $1, refresh_token_hash = $2 WHERE id = $3`,
      [now, newHash, sessionId]
    );
    return;
  }
  const s = memCollection('sessions').find(x => x.id === sessionId);
  if (s) {
    s.rotated_at = now;
    s.refresh_token_hash = newHash;
    await persistFile();
  }
}

export async function revokeSession(sessionId, { reuseDetected = false } = {}) {
  const now = new Date().toISOString();
  if (mode === 'pg') {
    await pgQuery(
      `UPDATE sessions SET revoked_at = COALESCE(revoked_at, $1), reuse_detected = reuse_detected OR $2 WHERE id = $3`,
      [now, reuseDetected, sessionId]
    );
    return;
  }
  const s = memCollection('sessions').find(x => x.id === sessionId);
  if (s) {
    if (!s.revoked_at) s.revoked_at = now;
    if (reuseDetected) s.reuse_detected = true;
    await persistFile();
  }
}

export async function revokeAllUserSessions(userId, { reuseDetected = false } = {}) {
  const now = new Date().toISOString();
  if (mode === 'pg') {
    await pgQuery(
      `UPDATE sessions SET revoked_at = COALESCE(revoked_at, $1), reuse_detected = reuse_detected OR $2 WHERE user_id = $3 AND revoked_at IS NULL`,
      [now, reuseDetected, userId]
    );
    return;
  }
  for (const s of memCollection('sessions')) {
    if (s.user_id === userId && !s.revoked_at) {
      s.revoked_at = now;
      if (reuseDetected) s.reuse_detected = true;
    }
  }
  await persistFile();
}

// ============ Workspaces ============
export async function createWorkspace({ name, owner_id }) {
  const id = newId();
  const created_at = new Date().toISOString();
  const ws = { id, name, owner_id, created_at };
  if (mode === 'pg') {
    await pgQuery(`INSERT INTO workspaces (id, name, owner_id, created_at) VALUES ($1, $2, $3, $4)`,
      [id, name, owner_id, created_at]);
    await pgQuery(`INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, 'admin')`,
      [id, owner_id]);
  } else {
    memCollection('workspaces').push(ws);
    memCollection('workspace_members').push({ workspace_id: id, user_id: owner_id, role: 'admin', added_at: created_at });
    await persistFile();
  }
  return ws;
}

export async function listWorkspacesForUser(userId) {
  if (mode === 'pg') {
    const { rows } = await pgQuery(
      `SELECT w.*, wm.role AS member_role
       FROM workspaces w
       JOIN workspace_members wm ON wm.workspace_id = w.id
       WHERE wm.user_id = $1
       ORDER BY w.created_at`,
      [userId]
    );
    return rows;
  }
  const memberships = memCollection('workspace_members').filter(m => m.user_id === userId);
  return memberships.map(m => {
    const ws = memCollection('workspaces').find(w => w.id === m.workspace_id);
    return ws ? { ...ws, member_role: m.role } : null;
  }).filter(Boolean);
}

export async function getWorkspaceMember(workspaceId, userId) {
  if (mode === 'pg') {
    const { rows } = await pgQuery(
      `SELECT * FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
      [workspaceId, userId]
    );
    return rows[0] || null;
  }
  return memCollection('workspace_members').find(m => m.workspace_id === workspaceId && m.user_id === userId) || null;
}

export async function addWorkspaceMember({ workspace_id, user_id, role = 'member' }) {
  const added_at = new Date().toISOString();
  if (mode === 'pg') {
    await pgQuery(
      `INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, $3)
       ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
      [workspace_id, user_id, role]
    );
  } else {
    const existing = memCollection('workspace_members').find(m => m.workspace_id === workspace_id && m.user_id === user_id);
    if (existing) existing.role = role;
    else memCollection('workspace_members').push({ workspace_id, user_id, role, added_at });
    await persistFile();
  }
  return { workspace_id, user_id, role, added_at };
}

export async function removeWorkspaceMember(workspaceId, userId) {
  if (mode === 'pg') {
    await pgQuery(`DELETE FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`, [workspaceId, userId]);
  } else {
    memStore.workspace_members = memCollection('workspace_members').filter(m => !(m.workspace_id === workspaceId && m.user_id === userId));
    await persistFile();
  }
}

export async function listWorkspaceMembers(workspaceId) {
  if (mode === 'pg') {
    const { rows } = await pgQuery(
      `SELECT u.id, u.email, u.name, wm.role
       FROM workspace_members wm
       JOIN users u ON u.id = wm.user_id
       WHERE wm.workspace_id = $1`,
      [workspaceId]
    );
    return rows;
  }
  return memCollection('workspace_members')
    .filter(m => m.workspace_id === workspaceId)
    .map(m => {
      const u = memCollection('users').find(x => x.id === m.user_id);
      return u ? { id: u.id, email: u.email, name: u.name, role: m.role } : null;
    })
    .filter(Boolean);
}

// ============ Collections / Requests / Environments / History ============
export async function listCollections(workspaceId) {
  if (mode === 'pg') {
    const { rows } = await pgQuery(`SELECT * FROM collections WHERE workspace_id = $1 ORDER BY created_at`, [workspaceId]);
    return rows;
  }
  return memCollection('collections').filter(c => c.workspace_id === workspaceId);
}

export async function upsertCollection({ id, workspace_id, name, description, data }) {
  const created_at = new Date().toISOString();
  const updated_at = created_at;
  const cid = id || newId();
  if (mode === 'pg') {
    await pgQuery(
      `INSERT INTO collections (id, workspace_id, name, description, data, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, data = EXCLUDED.data, updated_at = EXCLUDED.updated_at`,
      [cid, workspace_id, name, description || '', data || {}, created_at, updated_at]
    );
  } else {
    const list = memCollection('collections');
    const idx = list.findIndex(c => c.id === cid);
    const row = { id: cid, workspace_id, name, description: description || '', data: data || {}, created_at, updated_at };
    if (idx >= 0) list[idx] = { ...list[idx], ...row, created_at: list[idx].created_at };
    else list.push(row);
    await persistFile();
  }
  return { id: cid };
}

export async function deleteCollection(id) {
  if (mode === 'pg') {
    await pgQuery(`DELETE FROM collections WHERE id = $1`, [id]);
  } else {
    memStore.collections = memCollection('collections').filter(c => c.id !== id);
    await persistFile();
  }
}

// ============ Autonomy Studies ============
export async function listAutonomyStudies(workspaceId) {
  if (mode === 'pg') {
    const { rows } = await pgQuery(
      `SELECT * FROM autonomy_studies WHERE workspace_id = $1 ORDER BY updated_at DESC`,
      [workspaceId]
    );
    return rows;
  }
  return memCollection('autonomy_studies')
    .filter(study => study.workspace_id === workspaceId)
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
}

export async function upsertAutonomyStudy({ id, workspace_id, created_by, name, status = 'draft', data }) {
  const studyId = id || newId();
  const now = new Date().toISOString();
  if (mode === 'pg') {
    const { rows } = await pgQuery(
      `INSERT INTO autonomy_studies (id, workspace_id, created_by, name, status, data, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         status = EXCLUDED.status,
         data = EXCLUDED.data,
         updated_at = EXCLUDED.updated_at
       WHERE autonomy_studies.workspace_id = EXCLUDED.workspace_id
       RETURNING *`,
      [studyId, workspace_id, created_by || null, name, status, data || {}, now]
    );
    return rows[0] || null;
  }

  const list = memCollection('autonomy_studies');
  const index = list.findIndex(study => study.id === studyId);
  if (index >= 0 && list[index].workspace_id !== workspace_id) return null;
  if (index >= 0) {
    list[index] = { ...list[index], name, status, data: data || {}, updated_at: now };
  } else {
    list.push({
      id: studyId,
      workspace_id,
      created_by: created_by || null,
      name,
      status,
      data: data || {},
      created_at: now,
      updated_at: now,
    });
  }
  await persistFile();
  return list.find(study => study.id === studyId) || null;
}

export async function deleteAutonomyStudy(id, workspaceId) {
  if (mode === 'pg') {
    const { rowCount } = await pgQuery(
      `DELETE FROM autonomy_studies WHERE id = $1 AND workspace_id = $2`,
      [id, workspaceId]
    );
    return rowCount > 0;
  }
  const list = memCollection('autonomy_studies');
  const before = list.length;
  memStore.autonomy_studies = list.filter(study => study.id !== id || study.workspace_id !== workspaceId);
  await persistFile();
  return memStore.autonomy_studies.length < before;
}

export async function listEnvironments(workspaceId) {
  if (mode === 'pg') {
    const { rows } = await pgQuery(`SELECT * FROM environments WHERE workspace_id = $1 ORDER BY created_at`, [workspaceId]);
    return rows;
  }
  return memCollection('environments').filter(e => e.workspace_id === workspaceId);
}

export async function upsertEnvironment({ id, workspace_id, name, data }) {
  const eid = id || newId();
  const created_at = new Date().toISOString();
  if (mode === 'pg') {
    await pgQuery(
      `INSERT INTO environments (id, workspace_id, name, data, created_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, data = EXCLUDED.data`,
      [eid, workspace_id, name, data || {}, created_at]
    );
  } else {
    const list = memCollection('environments');
    const idx = list.findIndex(e => e.id === eid);
    const row = { id: eid, workspace_id, name, data: data || {}, created_at };
    if (idx >= 0) list[idx] = { ...list[idx], ...row, created_at: list[idx].created_at };
    else list.push(row);
    await persistFile();
  }
  return { id: eid };
}

export async function deleteEnvironment(id) {
  if (mode === 'pg') {
    await pgQuery(`DELETE FROM environments WHERE id = $1`, [id]);
  } else {
    memStore.environments = memCollection('environments').filter(e => e.id !== id);
    await persistFile();
  }
}

export async function listHistory(workspaceId, limit = 100) {
  if (mode === 'pg') {
    const { rows } = await pgQuery(
      `SELECT * FROM history WHERE workspace_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [workspaceId, limit]
    );
    return rows;
  }
  return memCollection('history')
    .filter(h => h.workspace_id === workspaceId)
    .slice(-limit)
    .reverse();
}

export async function appendHistory({ workspace_id, user_id, data }) {
  const id = newId();
  const created_at = new Date().toISOString();
  if (mode === 'pg') {
    await pgQuery(
      `INSERT INTO history (id, workspace_id, user_id, data, created_at) VALUES ($1, $2, $3, $4, $5)`,
      [id, workspace_id, user_id, data, created_at]
    );
  } else {
    memCollection('history').push({ id, workspace_id, user_id, data, created_at });
    if (memStore.history.length > 5000) memStore.history = memStore.history.slice(-5000);
    await persistFile();
  }
  return { id };
}

// ============ Audit ============
export async function appendAudit({ user_id, workspace_id, action, target_type, target_id, detail, ip }) {
  const id = newId();
  const created_at = new Date().toISOString();
  if (mode === 'pg') {
    await pgQuery(
      `INSERT INTO audit_log (id, user_id, workspace_id, action, target_type, target_id, detail, ip, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [id, user_id || null, workspace_id || null, action, target_type || null, target_id || null, detail || {}, ip || null, created_at]
    );
  } else {
    memCollection('audit_log').push({ id, user_id, workspace_id, action, target_type, target_id, detail, ip, created_at });
    if (memStore.audit_log.length > 5000) memStore.audit_log = memStore.audit_log.slice(-5000);
    await persistFile();
  }
  return { id };
}

export async function listAudit({ workspace_id, limit = 200 } = {}) {
  if (mode === 'pg') {
    if (workspace_id) {
      const { rows } = await pgQuery(
        `SELECT * FROM audit_log WHERE workspace_id = $1 ORDER BY created_at DESC LIMIT $2`,
        [workspace_id, limit]
      );
      return rows;
    }
    const { rows } = await pgQuery(`SELECT * FROM audit_log ORDER BY created_at DESC LIMIT $1`, [limit]);
    return rows;
  }
  let rows = memCollection('audit_log');
  if (workspace_id) rows = rows.filter(r => r.workspace_id === workspace_id);
  return [...rows].reverse().slice(0, limit);
}

// ============ Enterprise settings / retention / evidence ============
const DEFAULT_ENTERPRISE_SETTINGS = {
  id: 'default',
  data_retention_days: 365,
  audit_retention_days: 365,
  soc2_evidence_retention_days: 730,
  sso_required: false,
  scim_enabled: false,
};

const ENTERPRISE_SETTING_FIELDS = new Set([
  'data_retention_days',
  'audit_retention_days',
  'soc2_evidence_retention_days',
  'sso_required',
  'scim_enabled',
]);

function normaliseEnterpriseSettings(row = {}) {
  return {
    ...DEFAULT_ENTERPRISE_SETTINGS,
    ...row,
    data_retention_days: Number(row.data_retention_days ?? DEFAULT_ENTERPRISE_SETTINGS.data_retention_days),
    audit_retention_days: Number(row.audit_retention_days ?? DEFAULT_ENTERPRISE_SETTINGS.audit_retention_days),
    soc2_evidence_retention_days: Number(row.soc2_evidence_retention_days ?? DEFAULT_ENTERPRISE_SETTINGS.soc2_evidence_retention_days),
    sso_required: !!row.sso_required,
    scim_enabled: !!row.scim_enabled,
    updated_at: row.updated_at || new Date().toISOString(),
  };
}

function getOrCreateMemEnterpriseSettings() {
  const list = memCollection('enterprise_settings');
  let row = list.find(r => r.id === 'default');
  if (!row) {
    row = { ...DEFAULT_ENTERPRISE_SETTINGS, updated_at: new Date().toISOString() };
    list.push(row);
  }
  return row;
}

export async function getEnterpriseSettings() {
  if (mode === 'pg') {
    const { rows } = await pgQuery(`SELECT * FROM enterprise_settings WHERE id = 'default'`);
    if (rows[0]) return normaliseEnterpriseSettings(rows[0]);
    await pgQuery(`INSERT INTO enterprise_settings (id) VALUES ('default') ON CONFLICT (id) DO NOTHING`);
    return { ...DEFAULT_ENTERPRISE_SETTINGS, updated_at: new Date().toISOString() };
  }
  const row = getOrCreateMemEnterpriseSettings();
  return normaliseEnterpriseSettings(row);
}

export async function updateEnterpriseSettings(fields = {}) {
  const updates = {};
  for (const [key, value] of Object.entries(fields)) {
    if (!ENTERPRISE_SETTING_FIELDS.has(key)) continue;
    if (key.endsWith('_days')) {
      const n = Number(value);
      if (!Number.isInteger(n) || n < 1 || n > 3650) {
        throw new Error(`${key} must be an integer from 1 to 3650`);
      }
      updates[key] = n;
    } else {
      updates[key] = !!value;
    }
  }

  const updated_at = new Date().toISOString();
  if (mode === 'pg') {
    await pgQuery(`INSERT INTO enterprise_settings (id) VALUES ('default') ON CONFLICT (id) DO NOTHING`);
    const cols = [];
    const vals = [];
    let i = 1;
    for (const [key, value] of Object.entries(updates)) {
      cols.push(`${key} = $${i++}`);
      vals.push(value);
    }
    cols.push(`updated_at = $${i++}`);
    vals.push(updated_at);
    const { rows } = await pgQuery(
      `UPDATE enterprise_settings SET ${cols.join(', ')} WHERE id = 'default' RETURNING *`,
      vals
    );
    return normaliseEnterpriseSettings(rows[0]);
  }

  const row = getOrCreateMemEnterpriseSettings();
  Object.assign(row, updates, { updated_at });
  await persistFile();
  return normaliseEnterpriseSettings(row);
}

function retentionCutoff(days) {
  return new Date(Date.now() - Number(days) * 24 * 60 * 60 * 1000).toISOString();
}

function pruneMemList(name, predicate) {
  const before = memCollection(name).length;
  memStore[name] = memCollection(name).filter(row => !predicate(row));
  return before - memStore[name].length;
}

export async function runEnterpriseRetention(settings = null) {
  const cfg = settings || await getEnterpriseSettings();
  const auditCutoff = retentionCutoff(cfg.audit_retention_days);
  const dataCutoff = retentionCutoff(cfg.data_retention_days);
  const evidenceCutoff = retentionCutoff(cfg.soc2_evidence_retention_days);
  const counts = {
    audit_log: 0,
    history: 0,
    sessions: 0,
    agent_actions: 0,
    agent_issues: 0,
    soc2_evidence: 0,
  };

  if (mode === 'pg') {
    counts.audit_log = (await pgQuery(`DELETE FROM audit_log WHERE created_at < $1 RETURNING id`, [auditCutoff])).rowCount;
    counts.history = (await pgQuery(`DELETE FROM history WHERE created_at < $1 RETURNING id`, [dataCutoff])).rowCount;
    counts.sessions = (await pgQuery(
      `DELETE FROM sessions
       WHERE expires_at < $1 OR (revoked_at IS NOT NULL AND revoked_at < $1)
       RETURNING id`,
      [dataCutoff]
    )).rowCount;
    counts.agent_actions = (await pgQuery(`DELETE FROM agent_actions WHERE created_at < $1 RETURNING id`, [dataCutoff])).rowCount;
    counts.agent_issues = (await pgQuery(`DELETE FROM agent_issues WHERE detected_at < $1 RETURNING id`, [dataCutoff])).rowCount;
    counts.soc2_evidence = (await pgQuery(
      `DELETE FROM soc2_evidence
       WHERE collected_at IS NOT NULL AND collected_at < $1
       RETURNING id`,
      [evidenceCutoff]
    )).rowCount;
    return { counts, cutoffs: { audit: auditCutoff, data: dataCutoff, soc2_evidence: evidenceCutoff } };
  }

  counts.audit_log = pruneMemList('audit_log', row => row.created_at < auditCutoff);
  counts.history = pruneMemList('history', row => row.created_at < dataCutoff);
  counts.sessions = pruneMemList('sessions', row =>
    row.expires_at < dataCutoff || (row.revoked_at && row.revoked_at < dataCutoff)
  );
  counts.agent_actions = pruneMemList('agent_actions', row => row.created_at < dataCutoff);
  counts.agent_issues = pruneMemList('agent_issues', row => row.detected_at < dataCutoff);
  counts.soc2_evidence = pruneMemList('soc2_evidence', row => row.collected_at && row.collected_at < evidenceCutoff);
  await persistFile();
  return { counts, cutoffs: { audit: auditCutoff, data: dataCutoff, soc2_evidence: evidenceCutoff } };
}

export async function listSoc2Evidence({ status } = {}) {
  if (mode === 'pg') {
    if (status) {
      const { rows } = await pgQuery(`SELECT * FROM soc2_evidence WHERE status = $1 ORDER BY updated_at DESC`, [status]);
      return rows;
    }
    const { rows } = await pgQuery(`SELECT * FROM soc2_evidence ORDER BY updated_at DESC`);
    return rows;
  }
  let rows = memCollection('soc2_evidence');
  if (status) rows = rows.filter(r => r.status === status);
  return [...rows].sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));
}

export async function upsertSoc2Evidence({ id, control_id, title, owner, status = 'needed', detail = {}, due_at = null, collected_at = null }) {
  const eid = id || newId();
  const now = new Date().toISOString();
  const row = {
    id: eid,
    control_id,
    title,
    owner: owner || null,
    status,
    detail: detail || {},
    due_at: due_at || null,
    collected_at: collected_at || null,
    created_at: now,
    updated_at: now,
  };

  if (mode === 'pg') {
    await pgQuery(
      `INSERT INTO soc2_evidence (id, control_id, title, owner, status, detail, due_at, collected_at, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9)
       ON CONFLICT (id) DO UPDATE SET
         control_id = EXCLUDED.control_id,
         title = EXCLUDED.title,
         owner = EXCLUDED.owner,
         status = EXCLUDED.status,
         detail = EXCLUDED.detail,
         due_at = EXCLUDED.due_at,
         collected_at = EXCLUDED.collected_at,
         updated_at = EXCLUDED.updated_at`,
      [row.id, row.control_id, row.title, row.owner, row.status, row.detail, row.due_at, row.collected_at, row.updated_at]
    );
    const { rows } = await pgQuery(`SELECT * FROM soc2_evidence WHERE id = $1`, [eid]);
    return rows[0];
  }

  const list = memCollection('soc2_evidence');
  const idx = list.findIndex(r => r.id === eid);
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...row, created_at: list[idx].created_at };
  } else {
    list.push(row);
  }
  await persistFile();
  return idx >= 0 ? list[idx] : row;
}

export async function deleteSoc2Evidence(id) {
  if (mode === 'pg') {
    await pgQuery(`DELETE FROM soc2_evidence WHERE id = $1`, [id]);
  } else {
    memStore.soc2_evidence = memCollection('soc2_evidence').filter(r => r.id !== id);
    await persistFile();
  }
}

// ============ OIDC Configs ============
export async function listOidcConfigs() {
  if (mode === 'pg') {
    const { rows } = await pgQuery(`SELECT id, name, issuer, client_id, redirect_uri, scopes, created_at FROM oidc_configs ORDER BY created_at`);
    return rows;
  }
  return memCollection('oidc_configs').map(c => ({
    id: c.id, name: c.name, issuer: c.issuer, client_id: c.client_id, redirect_uri: c.redirect_uri, scopes: c.scopes, created_at: c.created_at,
  }));
}

export async function getOidcConfig(id) {
  if (mode === 'pg') {
    const { rows } = await pgQuery(`SELECT * FROM oidc_configs WHERE id = $1`, [id]);
    return rows[0] || null;
  }
  return memCollection('oidc_configs').find(c => c.id === id) || null;
}

export async function upsertOidcConfig({ id, name, issuer, client_id, client_secret_enc, redirect_uri, scopes }) {
  const cid = id || newId();
  const created_at = new Date().toISOString();
  if (mode === 'pg') {
    await pgQuery(
      `INSERT INTO oidc_configs (id, name, issuer, client_id, client_secret_enc, redirect_uri, scopes, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, issuer = EXCLUDED.issuer, client_id = EXCLUDED.client_id, client_secret_enc = EXCLUDED.client_secret_enc, redirect_uri = EXCLUDED.redirect_uri, scopes = EXCLUDED.scopes`,
      [cid, name, issuer, client_id, client_secret_enc, redirect_uri, scopes, created_at]
    );
  } else {
    const list = memCollection('oidc_configs');
    const idx = list.findIndex(c => c.id === cid);
    const row = { id: cid, name, issuer, client_id, client_secret_enc, redirect_uri, scopes, created_at };
    if (idx >= 0) list[idx] = { ...list[idx], ...row, created_at: list[idx].created_at };
    else list.push(row);
    await persistFile();
  }
  return { id: cid };
}

export async function deleteOidcConfig(id) {
  if (mode === 'pg') {
    await pgQuery(`DELETE FROM oidc_configs WHERE id = $1`, [id]);
  } else {
    memStore.oidc_configs = memCollection('oidc_configs').filter(c => c.id !== id);
    await persistFile();
  }
}

// ============ Agent: issues / actions / config ============
export async function createAgentIssue(issue) {
  const id = newId();
  const now = new Date().toISOString();
  const row = {
    id,
    workspace_id: issue.workspace_id || null,
    channel_type: issue.channel_type || 'slack',
    channel_id: issue.channel_id || null,
    channel_name: issue.channel_name || null,
    thread_ts: issue.thread_ts || null,
    user_id: issue.user_id || null,
    message_text: issue.message_text || '',
    endpoint: issue.endpoint || null,
    method: issue.method || null,
    error_code: issue.error_code || null,
    status: issue.status || 'detected',
    diagnosis: issue.diagnosis || null,
    fix: issue.fix || null,
    test_result: issue.test_result || null,
    detected_at: now,
    updated_at: now,
  };
  if (mode === 'pg') {
    await pgQuery(
      `INSERT INTO agent_issues (id, workspace_id, channel_type, channel_id, channel_name, thread_ts, user_id, message_text, endpoint, method, error_code, status, diagnosis, fix, test_result, detected_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
      [row.id, row.workspace_id, row.channel_type, row.channel_id, row.channel_name, row.thread_ts, row.user_id, row.message_text, row.endpoint, row.method, row.error_code, row.status, row.diagnosis, row.fix, row.test_result, row.detected_at, row.updated_at]
    );
  } else {
    memCollection('agent_issues').push(row);
    await persistFile();
  }
  return row;
}

export async function updateAgentIssue(id, patch) {
  const updated_at = new Date().toISOString();
  if (mode === 'pg') {
    const fields = [];
    const values = [];
    let i = 1;
    for (const [k, v] of Object.entries(patch)) {
      fields.push(`${k} = $${i++}`);
      values.push(v);
    }
    fields.push(`updated_at = $${i++}`);
    values.push(updated_at);
    values.push(id);
    await pgQuery(`UPDATE agent_issues SET ${fields.join(', ')} WHERE id = $${i}`, values);
    const { rows } = await pgQuery(`SELECT * FROM agent_issues WHERE id = $1`, [id]);
    return rows[0] || null;
  }
  const list = memCollection('agent_issues');
  const idx = list.findIndex(r => r.id === id);
  if (idx < 0) return null;
  list[idx] = { ...list[idx], ...patch, updated_at };
  await persistFile();
  return list[idx];
}

export async function getAgentIssue(id) {
  if (mode === 'pg') {
    const { rows } = await pgQuery(`SELECT * FROM agent_issues WHERE id = $1`, [id]);
    return rows[0] || null;
  }
  return memCollection('agent_issues').find(r => r.id === id) || null;
}

export async function listAgentIssues({ workspace_id, status, limit = 100 } = {}) {
  if (mode === 'pg') {
    const conds = [];
    const params = [];
    let i = 1;
    if (workspace_id) { conds.push(`workspace_id = $${i++}`); params.push(workspace_id); }
    if (status) { conds.push(`status = $${i++}`); params.push(status); }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    params.push(limit);
    const { rows } = await pgQuery(
      `SELECT * FROM agent_issues ${where} ORDER BY detected_at DESC LIMIT $${i}`,
      params
    );
    return rows;
  }
  let rows = memCollection('agent_issues');
  if (workspace_id) rows = rows.filter(r => r.workspace_id === workspace_id);
  if (status) rows = rows.filter(r => r.status === status);
  return [...rows].reverse().slice(0, limit);
}

export async function findRecentIssueByEndpoint({ workspace_id, channel_id, endpoint, withinMinutes = 30 }) {
  const cutoff = Date.now() - withinMinutes * 60 * 1000;
  const all = await listAgentIssues({ workspace_id, limit: 50 });
  return all.find(r =>
    r.channel_id === channel_id &&
    r.endpoint === endpoint &&
    new Date(r.detected_at).getTime() >= cutoff
  ) || null;
}

export async function appendAgentAction({ issue_id, action_type, result }) {
  const id = newId();
  const created_at = new Date().toISOString();
  const row = { id, issue_id, action_type, result: result || null, created_at };
  if (mode === 'pg') {
    await pgQuery(
      `INSERT INTO agent_actions (id, issue_id, action_type, result, created_at) VALUES ($1,$2,$3,$4,$5)`,
      [id, issue_id, action_type, result || null, created_at]
    );
  } else {
    memCollection('agent_actions').push(row);
    await persistFile();
  }
  return row;
}

export async function listAgentActions({ issue_id, limit = 200 } = {}) {
  if (mode === 'pg') {
    if (issue_id) {
      const { rows } = await pgQuery(
        `SELECT * FROM agent_actions WHERE issue_id = $1 ORDER BY created_at DESC LIMIT $2`,
        [issue_id, limit]
      );
      return rows;
    }
    const { rows } = await pgQuery(`SELECT * FROM agent_actions ORDER BY created_at DESC LIMIT $1`, [limit]);
    return rows;
  }
  let rows = memCollection('agent_actions');
  if (issue_id) rows = rows.filter(r => r.issue_id === issue_id);
  return [...rows].reverse().slice(0, limit);
}

export async function upsertAgentConfig({ id, workspace_id, channel_type, channel_id, channel_name, enabled, sensitivity, auto_fix }) {
  const cid = id || newId();
  const created_at = new Date().toISOString();
  const row = {
    id: cid,
    workspace_id: workspace_id || null,
    channel_type: channel_type || 'slack',
    channel_id,
    channel_name: channel_name || null,
    enabled: enabled !== undefined ? !!enabled : true,
    sensitivity: sensitivity || 'medium',
    auto_fix: !!auto_fix,
    created_at,
  };
  if (mode === 'pg') {
    await pgQuery(
      `INSERT INTO agent_config (id, workspace_id, channel_type, channel_id, channel_name, enabled, sensitivity, auto_fix, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (id) DO UPDATE SET workspace_id=EXCLUDED.workspace_id, channel_type=EXCLUDED.channel_type, channel_id=EXCLUDED.channel_id, channel_name=EXCLUDED.channel_name, enabled=EXCLUDED.enabled, sensitivity=EXCLUDED.sensitivity, auto_fix=EXCLUDED.auto_fix`,
      [row.id, row.workspace_id, row.channel_type, row.channel_id, row.channel_name, row.enabled, row.sensitivity, row.auto_fix, row.created_at]
    );
  } else {
    const list = memCollection('agent_config');
    const idx = list.findIndex(c => c.id === cid);
    if (idx >= 0) list[idx] = { ...list[idx], ...row };
    else list.push(row);
    await persistFile();
  }
  return row;
}

export async function listAgentConfigs(workspace_id) {
  if (mode === 'pg') {
    if (workspace_id) {
      const { rows } = await pgQuery(`SELECT * FROM agent_config WHERE workspace_id = $1 ORDER BY created_at`, [workspace_id]);
      return rows;
    }
    const { rows } = await pgQuery(`SELECT * FROM agent_config ORDER BY created_at`);
    return rows;
  }
  let rows = memCollection('agent_config');
  if (workspace_id) rows = rows.filter(r => r.workspace_id === workspace_id);
  return rows;
}

export async function getAgentConfigByChannel({ channel_type = 'slack', channel_id }) {
  if (mode === 'pg') {
    const { rows } = await pgQuery(
      `SELECT * FROM agent_config WHERE channel_type = $1 AND channel_id = $2 LIMIT 1`,
      [channel_type, channel_id]
    );
    return rows[0] || null;
  }
  return memCollection('agent_config').find(r => r.channel_type === channel_type && r.channel_id === channel_id) || null;
}

export async function deleteAgentConfig(id) {
  if (mode === 'pg') {
    await pgQuery(`DELETE FROM agent_config WHERE id = $1`, [id]);
  } else {
    memStore.agent_config = memCollection('agent_config').filter(c => c.id !== id);
    await persistFile();
  }
}

// ============ LLM Configs (per-user BYOK) ============
export async function getLlmConfig(userId) {
  if (!userId) return null;
  if (mode === 'pg') {
    const { rows } = await pgQuery(`SELECT * FROM llm_configs WHERE user_id = $1`, [userId]);
    return rows[0] || null;
  }
  return memCollection('llm_configs').find(c => c.user_id === userId) || null;
}

export async function upsertLlmConfig({ user_id, provider, api_key_enc, base_url, model_id, region, project_id, location, extra_config }) {
  if (!user_id || !provider) throw new Error('user_id and provider required');
  const updated_at = new Date().toISOString();
  if (mode === 'pg') {
    await pgQuery(
      `INSERT INTO llm_configs (user_id, provider, api_key_enc, base_url, model_id, region, project_id, location, extra_config, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)
       ON CONFLICT (user_id) DO UPDATE SET
         provider = EXCLUDED.provider,
         api_key_enc = EXCLUDED.api_key_enc,
         base_url = EXCLUDED.base_url,
         model_id = EXCLUDED.model_id,
         region = EXCLUDED.region,
         project_id = EXCLUDED.project_id,
         location = EXCLUDED.location,
         extra_config = EXCLUDED.extra_config,
         updated_at = EXCLUDED.updated_at`,
      [user_id, provider, api_key_enc || null, base_url || null, model_id || null, region || null, project_id || null, location || null, extra_config || {}, updated_at]
    );
  } else {
    const list = memCollection('llm_configs');
    const idx = list.findIndex(c => c.user_id === user_id);
    const row = {
      user_id, provider,
      api_key_enc: api_key_enc || null,
      base_url: base_url || null,
      model_id: model_id || null,
      region: region || null,
      project_id: project_id || null,
      location: location || null,
      extra_config: extra_config || {},
      created_at: idx >= 0 ? list[idx].created_at : updated_at,
      updated_at,
    };
    if (idx >= 0) list[idx] = row;
    else list.push(row);
    await persistFile();
  }
  return { user_id };
}

export async function deleteLlmConfig(userId) {
  if (mode === 'pg') {
    await pgQuery(`DELETE FROM llm_configs WHERE user_id = $1`, [userId]);
  } else {
    memStore.llm_configs = memCollection('llm_configs').filter(c => c.user_id !== userId);
    await persistFile();
  }
}

// ============ Test helpers (only for tests) ============
export function _resetForTests() {
  memStore = freshMemStore();
  mode = 'memory';
  pgPool = null;
}
