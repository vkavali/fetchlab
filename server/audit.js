import express from 'express';
import * as db from './db.js';
import { requireAuth, requireAdmin } from './auth.js';

export function buildAuditRouter() {
  const router = express.Router();

  router.get('/', requireAuth, requireAdmin, async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit, 10) || 200, 1000);
    const workspace_id = req.query.workspace_id || undefined;
    const rows = await db.listAudit({ workspace_id, limit });
    res.json({ entries: rows });
  });

  return router;
}
