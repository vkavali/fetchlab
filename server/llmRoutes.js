import express from 'express';
import { requireAuth } from './auth.js';
import { encrypt, decrypt } from './encryption.js';
import { appendAudit, getLlmConfig, upsertLlmConfig, deleteLlmConfig } from './db.js';
import { PROVIDER_TYPES, buildProvider, defaultProvider, describeDefaultProvider, LlmError } from './llm/index.js';

function maskKey(value) {
  if (!value) return '';
  const s = String(value);
  if (s.length <= 8) return '••••••';
  return `${s.slice(0, 4)}••••${s.slice(-4)}`;
}

// Convert a stored row into the shape the client expects (no secrets revealed).
function publicConfig(row) {
  if (!row) return null;
  const apiKeyPreview = row.api_key_enc ? maskKey(safeDecrypt(row.api_key_enc)) : '';
  return {
    provider: row.provider,
    has_api_key: !!row.api_key_enc,
    api_key_preview: apiKeyPreview,
    base_url: row.base_url || '',
    model_id: row.model_id || '',
    region: row.region || '',
    project_id: row.project_id || '',
    location: row.location || '',
    extra_config: sanitizeExtra(row.extra_config || {}),
    updated_at: row.updated_at,
  };
}

function safeDecrypt(value) {
  try { return decrypt(value); } catch { return ''; }
}

// Strip secrets from extra_config when returning to the client.
function sanitizeExtra(extra) {
  const SECRET_KEYS = ['aws_secret_access_key', 'aws_session_token', 'credentials_json'];
  const out = {};
  for (const [k, v] of Object.entries(extra)) {
    out[k] = SECRET_KEYS.includes(k) ? (v ? '••••' : '') : v;
  }
  return out;
}

// Decrypt API-key-like fields inside extra_config that we stored encrypted.
function decryptExtra(extra) {
  if (!extra) return {};
  const out = { ...extra };
  for (const k of ['aws_secret_access_key', 'aws_session_token', 'credentials_json']) {
    if (typeof out[k] === 'string' && out[k].startsWith('v1:')) {
      try { out[k] = decrypt(out[k]); } catch { /* keep as-is */ }
    }
  }
  return out;
}

// Build a provider instance for the given user — uses their BYOK config if present,
// otherwise the server default. Exported so ai-routes.js can call it on each request.
export async function getProviderForRequest(userId) {
  const row = userId ? await getLlmConfig(userId) : null;
  if (!row) {
    return { provider: defaultProvider(), source: 'server' };
  }
  const config = {
    apiKey: row.api_key_enc ? safeDecrypt(row.api_key_enc) : undefined,
    baseUrl: row.base_url || undefined,
    model: row.model_id || undefined,
    modelId: row.model_id || undefined,
    region: row.region || undefined,
    projectId: row.project_id || undefined,
    location: row.location || undefined,
    ...decryptExtra(row.extra_config || {}),
  };
  // For Bedrock, the AWS access key id is stored in api_key_enc and the secret
  // in extra_config.aws_secret_access_key.
  if (row.provider === 'bedrock') {
    config.accessKeyId = config.apiKey;
    config.secretAccessKey = config.aws_secret_access_key;
    config.sessionToken = config.aws_session_token;
  }
  return { provider: buildProvider(row.provider, config), source: 'byok' };
}

export function buildLlmSettingsRouter() {
  const router = express.Router();
  router.use(requireAuth);

  router.get('/', async (req, res) => {
    const row = await getLlmConfig(req.user.id);
    const def = describeDefaultProvider();
    res.json({
      config: publicConfig(row),
      server_default: def,
      providers: PROVIDER_TYPES,
      active_source: row ? 'byok' : 'server',
      active_provider: row ? row.provider : def.provider,
    });
  });

  router.put('/', async (req, res) => {
    try {
      const { provider, api_key, base_url, model_id, region, project_id, location, extra_config } = req.body || {};
      if (!provider || !PROVIDER_TYPES.includes(provider)) {
        return res.status(400).json({ error: `provider must be one of: ${PROVIDER_TYPES.join(', ')}` });
      }
      const extra = { ...(extra_config || {}) };
      // Encrypt secret fields inside extra_config in place.
      for (const k of ['aws_secret_access_key', 'aws_session_token', 'credentials_json']) {
        if (typeof extra[k] === 'string' && extra[k].length > 0) {
          extra[k] = encrypt(extra[k]);
        }
      }
      await upsertLlmConfig({
        user_id: req.user.id,
        provider,
        api_key_enc: api_key ? encrypt(api_key) : null,
        base_url: base_url || null,
        model_id: model_id || null,
        region: region || null,
        project_id: project_id || null,
        location: location || null,
        extra_config: extra,
      });
      await appendAudit({
        user_id: req.user.id, action: 'llm.config.upsert',
        target_type: 'llm_config', target_id: req.user.id,
        detail: { provider, model_id }, ip: req.ip,
      });
      const row = await getLlmConfig(req.user.id);
      res.json({ config: publicConfig(row) });
    } catch (err) {
      console.error('llm config upsert error:', err);
      res.status(500).json({ error: err.message || 'Failed to save LLM config' });
    }
  });

  router.delete('/', async (req, res) => {
    await deleteLlmConfig(req.user.id);
    await appendAudit({
      user_id: req.user.id, action: 'llm.config.delete',
      target_type: 'llm_config', target_id: req.user.id, ip: req.ip,
    });
    res.json({ ok: true });
  });

  router.post('/test', async (req, res) => {
    try {
      const { provider } = await getProviderForRequest(req.user.id);
      const result = await provider.chat(
        [{ role: 'user', content: 'Reply with exactly: pong' }],
        { maxTokens: 32 }
      );
      res.json({
        ok: true,
        provider: provider.name,
        model: result.usage?.model,
        preview: (result.content || '').slice(0, 200),
      });
    } catch (err) {
      const status = err instanceof LlmError ? (err.status || 500) : 500;
      res.status(status).json({
        ok: false,
        error: err.message || 'LLM test failed',
        provider: err.provider,
      });
    }
  });

  return router;
}
