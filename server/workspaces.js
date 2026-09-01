import express from 'express';
import * as db from './db.js';
import { requireAuth } from './auth.js';
import { encrypt, decrypt, isEncrypted } from './encryption.js';
import { appendAudit } from './db.js';

async function memberOrFail(req, res, workspaceId, requireRole = null) {
  const m = await db.getWorkspaceMember(workspaceId, req.user.id);
  if (!m) {
    res.status(403).json({ error: 'Not a member of this workspace' });
    return null;
  }
  if (requireRole) {
    const order = { viewer: 0, member: 1, admin: 2 };
    if ((order[m.role] ?? -1) < (order[requireRole] ?? 99)) {
      res.status(403).json({ error: `Requires ${requireRole} role` });
      return null;
    }
  }
  return m;
}

// Encrypt sensitive fields in any persisted JSON blob.
// Walks the object tree and encrypts string values whose key matches sensitive patterns.
const SENSITIVE_KEY_RE = /password|secret|token|api[_-]?key|client[_-]?secret|access[_-]?token|refresh[_-]?token/i;

function transformSecrets(value, op) {
  if (value == null) return value;
  if (Array.isArray(value)) return value.map(v => transformSecrets(v, op));
  if (typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (typeof v === 'string' && v.length > 0 && SENSITIVE_KEY_RE.test(k)) {
        if (op === 'encrypt') {
          out[k] = isEncrypted(v) ? v : encrypt(v);
        } else {
          out[k] = isEncrypted(v) ? (() => { try { return decrypt(v); } catch { return v; } })() : v;
        }
      } else {
        out[k] = transformSecrets(v, op);
      }
    }
    return out;
  }
  return value;
}

export const encryptSecrets = (v) => transformSecrets(v, 'encrypt');
export const decryptSecrets = (v) => transformSecrets(v, 'decrypt');

export function buildWorkspacesRouter() {
  const router = express.Router();

  router.use(requireAuth);

  // List my workspaces
  router.get('/', async (req, res) => {
    const ws = await db.listWorkspacesForUser(req.user.id);
    res.json({ workspaces: ws });
  });

  // Create
  router.post('/', async (req, res) => {
    const { name } = req.body || {};
    if (!name) return res.status(400).json({ error: 'name required' });
    const ws = await db.createWorkspace({ name, owner_id: req.user.id });
    await appendAudit({ user_id: req.user.id, workspace_id: ws.id, action: 'workspace.create', target_type: 'workspace', target_id: ws.id, detail: { name }, ip: req.ip });
    res.json({ workspace: ws });
  });

  // Members
  router.get('/:id/members', async (req, res) => {
    if (!(await memberOrFail(req, res, req.params.id))) return;
    const members = await db.listWorkspaceMembers(req.params.id);
    res.json({ members });
  });

  router.post('/:id/members', async (req, res) => {
    if (!(await memberOrFail(req, res, req.params.id, 'admin'))) return;
    const { email, role = 'member' } = req.body || {};
    if (!email) return res.status(400).json({ error: 'email required' });
    const target = await db.findUserByEmail(email);
    if (!target) return res.status(404).json({ error: 'User not found. They must register first.' });
    const result = await db.addWorkspaceMember({ workspace_id: req.params.id, user_id: target.id, role });
    await appendAudit({ user_id: req.user.id, workspace_id: req.params.id, action: 'workspace.member.add', target_type: 'user', target_id: target.id, detail: { email, role }, ip: req.ip });
    res.json(result);
  });

  router.put('/:id/members/:userId', async (req, res) => {
    if (!(await memberOrFail(req, res, req.params.id, 'admin'))) return;
    const { role } = req.body || {};
    if (!['admin', 'member', 'viewer'].includes(role)) return res.status(400).json({ error: 'invalid role' });
    const result = await db.addWorkspaceMember({ workspace_id: req.params.id, user_id: req.params.userId, role });
    await appendAudit({ user_id: req.user.id, workspace_id: req.params.id, action: 'workspace.member.update', target_type: 'user', target_id: req.params.userId, detail: { role }, ip: req.ip });
    res.json(result);
  });

  router.delete('/:id/members/:userId', async (req, res) => {
    if (!(await memberOrFail(req, res, req.params.id, 'admin'))) return;
    await db.removeWorkspaceMember(req.params.id, req.params.userId);
    await appendAudit({ user_id: req.user.id, workspace_id: req.params.id, action: 'workspace.member.remove', target_type: 'user', target_id: req.params.userId, ip: req.ip });
    res.json({ ok: true });
  });

  // Collections
  router.get('/:id/collections', async (req, res) => {
    if (!(await memberOrFail(req, res, req.params.id))) return;
    const rows = await db.listCollections(req.params.id);
    res.json({ collections: rows.map(r => ({ ...r, data: decryptSecrets(r.data) })) });
  });

  router.post('/:id/collections', async (req, res) => {
    if (!(await memberOrFail(req, res, req.params.id, 'member'))) return;
    const { id, name, description, data } = req.body || {};
    if (!name) return res.status(400).json({ error: 'name required' });
    const result = await db.upsertCollection({
      id, workspace_id: req.params.id, name, description,
      data: encryptSecrets(data),
    });
    await appendAudit({ user_id: req.user.id, workspace_id: req.params.id, action: 'collection.upsert', target_type: 'collection', target_id: result.id, detail: { name }, ip: req.ip });
    res.json(result);
  });

  router.delete('/:id/collections/:collectionId', async (req, res) => {
    if (!(await memberOrFail(req, res, req.params.id, 'member'))) return;
    await db.deleteCollection(req.params.collectionId);
    await appendAudit({ user_id: req.user.id, workspace_id: req.params.id, action: 'collection.delete', target_type: 'collection', target_id: req.params.collectionId, ip: req.ip });
    res.json({ ok: true });
  });

  // Autonomy studies
  router.get('/:id/autonomy-studies', async (req, res) => {
    if (!(await memberOrFail(req, res, req.params.id))) return;
    const rows = await db.listAutonomyStudies(req.params.id);
    res.json({ studies: rows.map(row => ({ ...row, data: decryptSecrets(row.data) })) });
  });

  router.post('/:id/autonomy-studies', async (req, res) => {
    if (!(await memberOrFail(req, res, req.params.id, 'member'))) return;
    const { id, name, status = 'draft', data } = req.body || {};
    if (!name || typeof name !== 'string') return res.status(400).json({ error: 'name required' });
    if (!['draft', 'rehearsal', 'pilot', 'decided'].includes(status)) {
      return res.status(400).json({ error: 'invalid status' });
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return res.status(400).json({ error: 'data object required' });
    }
    const study = await db.upsertAutonomyStudy({
      id,
      workspace_id: req.params.id,
      created_by: req.user.id,
      name: name.trim(),
      status,
      data: encryptSecrets(data),
    });
    if (!study) return res.status(409).json({ error: 'Study id belongs to another workspace' });
    await appendAudit({
      user_id: req.user.id,
      workspace_id: req.params.id,
      action: 'autonomy.study.upsert',
      target_type: 'autonomy_study',
      target_id: study.id,
      detail: { name: name.trim(), status },
      ip: req.ip,
    });
    res.json({ study: { ...study, data: decryptSecrets(study.data) } });
  });

  router.delete('/:id/autonomy-studies/:studyId', async (req, res) => {
    if (!(await memberOrFail(req, res, req.params.id, 'member'))) return;
    const removed = await db.deleteAutonomyStudy(req.params.studyId, req.params.id);
    if (!removed) return res.status(404).json({ error: 'Study not found' });
    await appendAudit({
      user_id: req.user.id,
      workspace_id: req.params.id,
      action: 'autonomy.study.delete',
      target_type: 'autonomy_study',
      target_id: req.params.studyId,
      ip: req.ip,
    });
    res.json({ ok: true });
  });

  router.post('/:id/autonomy-studies/:studyId/tunnel', async (req, res) => {
    if (!(await memberOrFail(req, res, req.params.id, 'member'))) return;
    if (!process.env.TUNNEL_URL) {
      return res.status(503).json({ error: 'Tunnel integration is not configured', fallback: 'copy' });
    }

    const studies = await db.listAutonomyStudies(req.params.id);
    const stored = studies.find(study => study.id === req.params.studyId);
    if (!stored) return res.status(404).json({ error: 'Study not found' });

    const { handoff } = req.body || {};
    const contract = handoff?.autonomy_contract;
    if (handoff?.kind !== 'agent-tunnel.task' || typeof handoff.objective !== 'string' || !handoff.objective.trim()) {
      return res.status(400).json({ error: 'Valid Tunnel handoff required' });
    }
    if (handoff.objective.length > 100000) return res.status(413).json({ error: 'Tunnel objective is too large' });
    if (contract?.study_id !== stored.id || contract?.authority?.selected_level !== stored.data?.selectedLevel) {
      return res.status(409).json({ error: 'Handoff authority does not match the saved study' });
    }

    let endpoint;
    try {
      const base = new URL(process.env.TUNNEL_URL);
      if (!['http:', 'https:'].includes(base.protocol)) throw new Error('unsupported protocol');
      endpoint = new URL('/api/tasks', base).toString();
    } catch {
      return res.status(500).json({ error: 'TUNNEL_URL is invalid' });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const upstream = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          objective: handoff.objective,
          agents: [],
          budget_mode: 'standard',
        }),
        signal: controller.signal,
      });
      const payload = await upstream.json().catch(() => ({}));
      if (!upstream.ok || !payload.task_id) {
        return res.status(502).json({ error: 'Tunnel rejected the handoff', status: upstream.status });
      }
      await appendAudit({
        user_id: req.user.id,
        workspace_id: req.params.id,
        action: 'autonomy.study.handoff',
        target_type: 'autonomy_study',
        target_id: stored.id,
        detail: { tunnel_task_id: payload.task_id, authority: stored.data?.selectedLevel },
        ip: req.ip,
      });
      return res.json({ task_id: payload.task_id });
    } catch (error) {
      const message = error?.name === 'AbortError' ? 'Tunnel handoff timed out' : 'Tunnel is unreachable';
      return res.status(502).json({ error: message });
    } finally {
      clearTimeout(timeout);
    }
  });
  // Environments
  router.get('/:id/environments', async (req, res) => {
    if (!(await memberOrFail(req, res, req.params.id))) return;
    const rows = await db.listEnvironments(req.params.id);
    res.json({ environments: rows.map(r => ({ ...r, data: decryptSecrets(r.data) })) });
  });

  router.post('/:id/environments', async (req, res) => {
    if (!(await memberOrFail(req, res, req.params.id, 'member'))) return;
    const { id, name, data } = req.body || {};
    if (!name) return res.status(400).json({ error: 'name required' });
    const result = await db.upsertEnvironment({
      id, workspace_id: req.params.id, name, data: encryptSecrets(data),
    });
    await appendAudit({ user_id: req.user.id, workspace_id: req.params.id, action: 'environment.upsert', target_type: 'environment', target_id: result.id, detail: { name }, ip: req.ip });
    res.json(result);
  });

  router.delete('/:id/environments/:envId', async (req, res) => {
    if (!(await memberOrFail(req, res, req.params.id, 'member'))) return;
    await db.deleteEnvironment(req.params.envId);
    await appendAudit({ user_id: req.user.id, workspace_id: req.params.id, action: 'environment.delete', target_type: 'environment', target_id: req.params.envId, ip: req.ip });
    res.json({ ok: true });
  });

  // History
  router.get('/:id/history', async (req, res) => {
    if (!(await memberOrFail(req, res, req.params.id))) return;
    const rows = await db.listHistory(req.params.id);
    res.json({ history: rows.map(r => ({ ...r, data: decryptSecrets(r.data) })) });
  });

  router.post('/:id/history', async (req, res) => {
    if (!(await memberOrFail(req, res, req.params.id))) return;
    const { data } = req.body || {};
    const result = await db.appendHistory({ workspace_id: req.params.id, user_id: req.user.id, data: encryptSecrets(data) });
    res.json(result);
  });

  return router;
}
