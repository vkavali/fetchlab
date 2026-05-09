import express from 'express';
import { requireAuth } from './auth.js';
import { appendAudit } from './db.js';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001';

export async function callAnthropic({ prompt, system, maxTokens = 1024, model = DEFAULT_MODEL, fetchImpl = fetch }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    const err = new Error('ANTHROPIC_API_KEY is not configured');
    err.status = 503;
    throw err;
  }
  const body = {
    model,
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: prompt }],
  };
  if (system) body.system = system;

  const res = await fetchImpl(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data?.error?.message || `Anthropic error ${res.status}`);
    err.status = res.status;
    throw err;
  }
  const text = Array.isArray(data.content)
    ? data.content.filter(c => c.type === 'text').map(c => c.text).join('\n')
    : '';
  return { text, raw: data, model: data.model || model };
}

export function buildAiRouter() {
  const router = express.Router();

  router.use(requireAuth);

  router.get('/status', (_req, res) => {
    res.json({
      enabled: Boolean(process.env.ANTHROPIC_API_KEY),
      model: DEFAULT_MODEL,
    });
  });

  router.post('/diagnose', async (req, res) => {
    try {
      const { request, response } = req.body || {};
      if (!request || !response) {
        return res.status(400).json({ error: 'request and response required' });
      }
      const summary = `HTTP ${request.method || 'GET'} ${request.url || ''} → ${response.status} ${response.statusText || ''}`;
      const prompt = `You are an API debugging assistant. Diagnose this failing HTTP request and suggest concrete fixes.

Request:
${JSON.stringify(request, null, 2).slice(0, 4000)}

Response:
${JSON.stringify(response, null, 2).slice(0, 4000)}

Summary: ${summary}

Return a short diagnosis (3-5 bullets) and 2-3 suggested fixes. Be specific.`;
      const result = await callAnthropic({ prompt, maxTokens: 800 });
      await appendAudit({
        user_id: req.user.id, action: 'ai.diagnose',
        detail: { url: request.url, status: response.status, model: result.model }, ip: req.ip,
      });
      res.json({ diagnosis: result.text, model: result.model });
    } catch (err) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message });
    }
  });

  router.post('/generate-tests', async (req, res) => {
    try {
      const { request, response } = req.body || {};
      if (!request) return res.status(400).json({ error: 'request required' });
      const prompt = `Generate a fetchlab test script (uses fl.test, fl.expect, fl.response.body) that validates this API call. Output ONLY JavaScript, no markdown fences.

Request: ${JSON.stringify(request).slice(0, 3000)}
${response ? `Response: ${JSON.stringify(response).slice(0, 3000)}` : ''}`;
      const result = await callAnthropic({ prompt, maxTokens: 1200 });
      const cleaned = result.text.replace(/^```(?:javascript|js)?\s*/, '').replace(/```\s*$/, '');
      await appendAudit({
        user_id: req.user.id, action: 'ai.generate_tests',
        detail: { url: request.url, model: result.model }, ip: req.ip,
      });
      res.json({ script: cleaned, model: result.model });
    } catch (err) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message });
    }
  });

  return router;
}
