import Anthropic from '@anthropic-ai/sdk';

const MODEL = 'claude-sonnet-4-6';

let client = null;
function getClient() {
  if (client) return client;
  if (!process.env.ANTHROPIC_API_KEY) return null;
  client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

function requireKey(res) {
  const c = getClient();
  if (!c) {
    res.status(503).json({
      error: 'AI features unavailable',
      message: 'ANTHROPIC_API_KEY environment variable is not set on the server.',
    });
    return null;
  }
  return c;
}

// Extract a JSON object/array from a model response that may be wrapped in
// prose or fenced code blocks.
function extractJson(text) {
  if (!text) throw new Error('Empty response from model');
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fence ? fence[1].trim() : text.trim();
  // Try direct parse first
  try { return JSON.parse(candidate); } catch { /* fall through */ }
  // Find first { ... last }
  const objStart = candidate.indexOf('{');
  const objEnd = candidate.lastIndexOf('}');
  if (objStart >= 0 && objEnd > objStart) {
    try { return JSON.parse(candidate.substring(objStart, objEnd + 1)); } catch { /* fall through */ }
  }
  const arrStart = candidate.indexOf('[');
  const arrEnd = candidate.lastIndexOf(']');
  if (arrStart >= 0 && arrEnd > arrStart) {
    try { return JSON.parse(candidate.substring(arrStart, arrEnd + 1)); } catch { /* fall through */ }
  }
  throw new Error('Model did not return valid JSON');
}

function getText(message) {
  return message.content
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('\n');
}

// Truncate a string to keep token usage bounded.
function clip(str, max = 4000) {
  if (typeof str !== 'string') return str;
  if (str.length <= max) return str;
  return str.substring(0, max) + `\n... [truncated ${str.length - max} chars]`;
}

export function registerAiRoutes(app) {
  // ============================================================
  // 1. Generate request from natural language or context
  // ============================================================
  app.post('/api/ai/generate-request', async (req, res) => {
    const c = requireKey(res);
    if (!c) return;
    try {
      const { prompt } = req.body || {};
      if (!prompt || typeof prompt !== 'string') {
        return res.status(400).json({ error: 'Missing "prompt" string in body' });
      }

      const message = await c.messages.create({
        model: MODEL,
        max_tokens: 1024,
        system: `You are an HTTP request generator for the FetchLab API client. Convert the user's natural-language description into a single HTTP request.

Respond ONLY with a JSON object — no prose, no markdown fences. The shape MUST be:
{
  "method": "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS",
  "url": "https://...",
  "headers": [{ "key": "Header-Name", "value": "header value" }],
  "params": [{ "key": "queryKey", "value": "queryValue" }],
  "body": { "type": "none" | "json" | "raw", "content": "..." },
  "name": "short descriptive name"
}

Rules:
- Use real, well-known public API URLs when the user mentions a known service (GitHub, Stripe, OpenAI, etc.)
- For auth, add an Authorization header with a placeholder like "Bearer YOUR_TOKEN_HERE"
- For JSON request bodies set headers to include Content-Type: application/json
- "body.content" must be a string (stringified JSON for type "json")
- Omit fields that don't apply but always include the keys above
- Keep the name under 60 characters`,
        messages: [{ role: 'user', content: prompt }],
      });

      const text = getText(message);
      const parsed = extractJson(text);
      res.json(parsed);
    } catch (err) {
      console.error('generate-request error:', err);
      res.status(500).json({ error: err.message || 'AI generation failed' });
    }
  });

  // ============================================================
  // 2. Generate fl.* test assertions from a response shape
  // ============================================================
  app.post('/api/ai/generate-tests', async (req, res) => {
    const c = requireKey(res);
    if (!c) return;
    try {
      const { method, url, status, statusText, headers, body, time } = req.body || {};
      if (status === undefined) {
        return res.status(400).json({ error: 'Missing response status' });
      }

      const ctx = {
        method: method || 'GET',
        url: url || '',
        status,
        statusText: statusText || '',
        time: typeof time === 'number' ? Math.round(time) : undefined,
        headers: headers || {},
        body: clip(typeof body === 'string' ? body : JSON.stringify(body), 3000),
      };

      const message = await c.messages.create({
        model: MODEL,
        max_tokens: 1024,
        system: `You generate test assertions for the FetchLab API client. Use ONLY this scripting API:

  fl.test("name", () => { ... })  — register a test
  fl.expect(value).toBe(expected)
  fl.expect(value).toContain(expected)
  fl.expect(value).toBeGreaterThan(n)
  fl.expect(value).toBeLessThan(n)
  fl.expect(value).toBeTruthy()
  fl.expect(value).toBeFalsy()
  fl.expect(value).toHaveLength(n)
  fl.expect(value).toHaveProperty("name")
  fl.response.status — number
  fl.response.statusText — string
  fl.response.body — parsed JSON object/array (or string if not JSON)
  fl.response.headers — object
  fl.response.time — milliseconds (number)

Respond with ONLY the JavaScript test code — no markdown fences, no prose, no imports, no surrounding function. Each assertion goes inside fl.test(). Generate 4-8 useful, specific assertions:
- Always assert the status code
- Assert a reasonable response time bound (round up generously)
- Assert content-type if relevant
- Assert key fields/types/lengths in the body when JSON
- Use realistic, type-aware checks (typeof for numbers/strings, Array.isArray, etc.)`,
        messages: [
          {
            role: 'user',
            content: `Generate test assertions for this response.\n\n${JSON.stringify(ctx, null, 2)}`,
          },
        ],
      });

      const text = getText(message).trim();
      // Strip code fences if present
      const cleaned = text.replace(/^```(?:javascript|js)?\s*/i, '').replace(/```\s*$/, '').trim();
      res.json({ script: cleaned });
    } catch (err) {
      console.error('generate-tests error:', err);
      res.status(500).json({ error: err.message || 'AI generation failed' });
    }
  });

  // ============================================================
  // 3. Diagnose a 4xx/5xx error
  // ============================================================
  app.post('/api/ai/diagnose', async (req, res) => {
    const c = requireKey(res);
    if (!c) return;
    try {
      const { method, url, status, statusText, requestHeaders, requestBody, responseHeaders, responseBody, authType, time } = req.body || {};

      const ctx = {
        request: {
          method: method || 'GET',
          url: url || '',
          authType: authType || 'none',
          headers: requestHeaders || {},
          body: clip(typeof requestBody === 'string' ? requestBody : JSON.stringify(requestBody || ''), 1500),
        },
        response: {
          status,
          statusText: statusText || '',
          time,
          headers: responseHeaders || {},
          body: clip(typeof responseBody === 'string' ? responseBody : JSON.stringify(responseBody || ''), 2000),
        },
      };

      const message = await c.messages.create({
        model: MODEL,
        max_tokens: 1024,
        system: `You are an API debugging assistant. Given a failed HTTP request, give SPECIFIC, ACTIONABLE diagnosis. Don't repeat generic HTTP definitions — analyze THIS request.

Respond with ONLY a JSON object — no prose, no markdown:
{
  "summary": "1-2 sentence root cause assessment specific to this request",
  "severity": "critical" | "warning" | "info",
  "likelyCause": "the single most likely cause",
  "fixes": [
    { "title": "Action to take", "detail": "Why and how", "code": "optional code/header snippet" }
  ]
}

Rules:
- Reference specific values from the request/response (header names, error message text, URL paths)
- Don't say "check your token" — say WHICH token field is wrong and HOW
- Provide 2-4 fixes ordered by likelihood
- Keep "code" snippets tiny and copy-pasteable, omit when not useful`,
        messages: [
          {
            role: 'user',
            content: `Diagnose this failed request:\n\n${JSON.stringify(ctx, null, 2)}`,
          },
        ],
      });

      const text = getText(message);
      const parsed = extractJson(text);
      res.json(parsed);
    } catch (err) {
      console.error('diagnose error:', err);
      res.status(500).json({ error: err.message || 'AI diagnosis failed' });
    }
  });

  // ============================================================
  // 4. Explain a response diff in plain English
  // ============================================================
  app.post('/api/ai/explain-diff', async (req, res) => {
    const c = requireKey(res);
    if (!c) return;
    try {
      const { changes, leftLabel, rightLabel } = req.body || {};
      if (!Array.isArray(changes)) {
        return res.status(400).json({ error: 'Missing "changes" array' });
      }

      const compactChanges = changes.slice(0, 80).map(c => ({
        type: c.type,
        path: c.path,
        oldValue: clip(JSON.stringify(c.oldValue), 200),
        newValue: clip(JSON.stringify(c.newValue), 200),
      }));

      const message = await c.messages.create({
        model: MODEL,
        max_tokens: 800,
        system: `You explain API response diffs in plain English to a developer. Respond with ONLY a JSON object:
{
  "summary": "1-2 sentence overview of what changed",
  "breaking": true | false,
  "breakingReason": "if breaking, why; otherwise empty string",
  "highlights": [
    { "change": "short description", "impact": "what this means for API consumers" }
  ]
}

Rules:
- A change is BREAKING if: a field was removed, a type changed, an enum value vanished, or a required structural shape changed.
- Adding new fields is NOT breaking.
- Cosmetic value changes (timestamps, ids, counts) are NOT breaking.
- Pick 2-5 most important highlights, skip noise.`,
        messages: [
          {
            role: 'user',
            content: `Compare ${leftLabel || 'snapshot'} -> ${rightLabel || 'current'}.\n\nChanges:\n${JSON.stringify(compactChanges, null, 2)}`,
          },
        ],
      });

      const text = getText(message);
      const parsed = extractJson(text);
      res.json(parsed);
    } catch (err) {
      console.error('explain-diff error:', err);
      res.status(500).json({ error: err.message || 'AI explanation failed' });
    }
  });

  // ============================================================
  // 5. Generate OpenAPI 3.0 spec from a collection + traffic
  // ============================================================
  app.post('/api/ai/generate-spec', async (req, res) => {
    const c = requireKey(res);
    if (!c) return;
    try {
      const { collectionName, requests } = req.body || {};
      if (!Array.isArray(requests) || requests.length === 0) {
        return res.status(400).json({ error: 'Missing "requests" array' });
      }

      const compact = requests.slice(0, 50).map(r => ({
        name: r.name,
        method: r.method,
        url: r.url,
        headers: (r.headers || []).filter(h => h.key && !/^authorization$/i.test(h.key)).map(h => ({ key: h.key, value: h.value })),
        params: (r.params || []).filter(p => p.key).map(p => ({ key: p.key, value: p.value })),
        bodySample: r.body ? clip(typeof r.body === 'string' ? r.body : JSON.stringify(r.body), 800) : '',
        responseStatus: r.responseStatus,
        responseSample: clip(r.responseSample || '', 1500),
      }));

      const message = await c.messages.create({
        model: MODEL,
        max_tokens: 4096,
        system: `You generate OpenAPI 3.0 specifications in YAML from observed HTTP traffic. Output ONLY raw YAML — no markdown fences, no commentary, no explanations.

Required structure:
- openapi: 3.0.3
- info: { title, version, description }
- servers: derive from request URLs (use the common base URL)
- paths: one entry per unique URL path, with methods, parameters, requestBody, and responses
- components/schemas: infer from response samples when present

Rules:
- Replace numeric IDs in URLs with path parameters like /users/{id}
- Infer parameter types from values (string, integer, boolean)
- Generate response schemas from the response samples
- Be concise; do not include security schemes unless headers indicate auth
- Make the YAML valid and well-indented with 2 spaces`,
        messages: [
          {
            role: 'user',
            content: `Generate an OpenAPI 3.0 YAML spec for collection "${collectionName || 'API'}".\n\nObserved requests:\n${JSON.stringify(compact, null, 2)}`,
          },
        ],
      });

      const text = getText(message).trim();
      const cleaned = text.replace(/^```(?:yaml|yml)?\s*/i, '').replace(/```\s*$/, '').trim();
      res.json({ yaml: cleaned });
    } catch (err) {
      console.error('generate-spec error:', err);
      res.status(500).json({ error: err.message || 'AI spec generation failed' });
    }
  });

  // ============================================================
  // Status endpoint — lets the UI know if AI is configured
  // ============================================================
  app.get('/api/ai/status', (req, res) => {
    res.json({
      enabled: !!process.env.ANTHROPIC_API_KEY,
      model: MODEL,
    });
  });
}
