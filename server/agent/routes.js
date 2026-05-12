import express from 'express';
import { requireAuth } from '../auth.js';
import {
  listAgentIssues, getAgentIssue, listAgentActions,
  upsertAgentConfig, listAgentConfigs, deleteAgentConfig,
  appendAudit,
} from '../db.js';
import { applyFix, openPr, ignoreIssue, snoozeIssue } from './actions.js';
import { processIncomingMessage } from './agent.js';
import { startSlackBot } from './slack-bot.js';

export function buildAgentRouter() {
  const router = express.Router();

  router.use(requireAuth);

  // ---- Issues ----
  router.get('/issues', async (req, res) => {
    const { workspace_id, status, limit } = req.query;
    const issues = await listAgentIssues({
      workspace_id: workspace_id || undefined,
      status: status || undefined,
      limit: limit ? Math.min(parseInt(limit, 10), 500) : 100,
    });
    res.json({ issues });
  });

  router.get('/issues/:id', async (req, res) => {
    const issue = await getAgentIssue(req.params.id);
    if (!issue) return res.status(404).json({ error: 'Issue not found' });
    const actions = await listAgentActions({ issue_id: issue.id });
    res.json({ issue, actions });
  });

  router.post('/issues/:id/approve', async (req, res) => {
    try {
      const result = await applyFix(req.params.id, { user_id: req.user.id });
      await appendAudit({ user_id: req.user.id, action: 'agent.apply_fix', target_type: 'agent_issue', target_id: req.params.id, ip: req.ip });
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.post('/issues/:id/ignore', async (req, res) => {
    try {
      const result = await ignoreIssue(req.params.id, { user_id: req.user.id });
      await appendAudit({ user_id: req.user.id, action: 'agent.ignore', target_type: 'agent_issue', target_id: req.params.id, ip: req.ip });
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.post('/issues/:id/snooze', async (req, res) => {
    try {
      const minutes = parseInt(req.body?.minutes, 10) || 60;
      const result = await snoozeIssue(req.params.id, { user_id: req.user.id, durationMinutes: minutes });
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.post('/issues/:id/open-pr', async (req, res) => {
    try {
      const result = await openPr(req.params.id, { user_id: req.user.id });
      await appendAudit({ user_id: req.user.id, action: 'agent.open_pr', target_type: 'agent_issue', target_id: req.params.id, detail: { pr: result.pr }, ip: req.ip });
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // ---- Activity feed (issues + actions interleaved) ----
  router.get('/activity', async (req, res) => {
    const issues = await listAgentIssues({
      workspace_id: req.query.workspace_id || undefined,
      limit: 50,
    });
    const actions = await listAgentActions({ limit: 100 });
    const events = [
      ...issues.map(i => ({ kind: 'issue', at: i.detected_at, ...i })),
      ...actions.map(a => ({ kind: 'action', at: a.created_at, ...a })),
    ].sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 100);
    res.json({ events });
  });

  // ---- Config ----
  router.get('/config', async (req, res) => {
    const configs = await listAgentConfigs(req.query.workspace_id || undefined);
    res.json({ configs });
  });

  router.post('/configure', async (req, res) => {
    try {
      const { workspace_id, channel_type = 'slack', channel_id, channel_name, enabled, sensitivity, auto_fix } = req.body || {};
      if (!channel_id) return res.status(400).json({ error: 'channel_id required' });
      const cfg = await upsertAgentConfig({
        workspace_id, channel_type, channel_id, channel_name,
        enabled: enabled !== false, sensitivity, auto_fix: !!auto_fix,
      });
      await appendAudit({ user_id: req.user.id, action: 'agent.configure', target_type: 'agent_config', target_id: cfg.id, detail: { channel_id, channel_type }, ip: req.ip });
      res.json(cfg);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.put('/settings/:id', async (req, res) => {
    try {
      const cfg = await upsertAgentConfig({ id: req.params.id, ...req.body });
      res.json(cfg);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.delete('/config/:id', async (req, res) => {
    await deleteAgentConfig(req.params.id);
    res.json({ ok: true });
  });

  // ---- Bot lifecycle ----
  router.post('/bot/start', async (_req, res) => {
    try {
      const ok = await startSlackBot();
      res.json({ started: ok });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/status', (_req, res) => {
    res.json({
      slackEnabled: !!(process.env.SLACK_BOT_TOKEN && process.env.SLACK_APP_TOKEN),
      githubEnabled: !!(process.env.GITHUB_TOKEN && process.env.GITHUB_REPO),
      aiEnabled: !!process.env.ANTHROPIC_API_KEY,
    });
  });

  // ---- Manual / test ingestion (for dashboard "test message" feature) ----
  router.post('/ingest', async (req, res) => {
    try {
      const { text, channel_id, channel_name, workspace_id, sensitivity } = req.body || {};
      if (!text) return res.status(400).json({ error: 'text required' });
      const issue = await processIncomingMessage(
        { text, channel_id: channel_id || 'manual', channel_name, workspace_id, channel_type: 'manual' },
        { sensitivity, reportToChannel: false },
      );
      res.json({ issue });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
