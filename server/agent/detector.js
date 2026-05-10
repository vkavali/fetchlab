import { callAnthropic } from './anthropic.js';
import { findRecentIssueByEndpoint } from '../db.js';

const API_KEYWORDS = [
  'api', 'endpoint', 'request', 'response', 'http', 'rest', 'graphql',
  '4xx', '5xx', '500', '502', '503', '504', '400', '401', '403', '404', '429',
  'timeout', 'timed out', 'failing', 'broken', 'error', 'errors', 'failed',
  'curl', 'fetch', 'postman', 'webhook', 'auth', 'authentication', 'unauthorized',
  'cors', 'rate limit', 'throttled', 'gateway',
];

const CONTEXTUAL_REFERENCES = [
  /\bit('?s| is)? (broken|failing|down|not working|borked)( again)?\b/i,
  /\bbroken again\b/i,
  /\bsame (error|issue|problem)\b/i,
  /\bstill (broken|failing|erroring)\b/i,
];

const METHOD_RE = /\b(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/i;
const ENDPOINT_RE = /(?<![A-Za-z])(\/[A-Za-z0-9_\-./{}]+)/;
const URL_RE = /\bhttps?:\/\/[^\s<>"`]+/i;
const STATUS_RE = /\b(4\d{2}|5\d{2})\b/;

export function looksApiRelated(text) {
  if (!text || typeof text !== 'string') return false;
  const lc = text.toLowerCase();
  if (CONTEXTUAL_REFERENCES.some(re => re.test(text))) return true;
  if (URL_RE.test(text) || METHOD_RE.test(text) || STATUS_RE.test(text)) return true;
  return API_KEYWORDS.some(k => lc.includes(k));
}

export function quickExtract(text) {
  const out = {};
  const url = text.match(URL_RE);
  if (url) out.url = url[0].replace(/[).,;!?]+$/, '');
  const method = text.match(METHOD_RE);
  if (method) out.method = method[1].toUpperCase();
  const status = text.match(STATUS_RE);
  if (status) out.errorCode = parseInt(status[1], 10);
  const endpoint = text.match(ENDPOINT_RE);
  if (endpoint && !out.url) out.endpoint = endpoint[1];
  if (!out.endpoint && out.url) {
    try { out.endpoint = new URL(out.url).pathname; } catch { /* ignore */ }
  }
  return out;
}

export async function classifyWithAi(text, { fetchImpl, anthropicCall = callAnthropic } = {}) {
  const prompt = `You are an API issue classifier. Given a chat message, decide if it describes a problem with an HTTP API.
Return ONLY valid minified JSON of this shape:
{"is_api_issue": boolean, "confidence": "low"|"medium"|"high", "endpoint": string|null, "method": string|null, "error_description": string|null, "status_code": number|null}

Message:
"""${text.slice(0, 1500)}"""`;
  const result = await anthropicCall({ prompt, maxTokens: 300, fetchImpl });
  const raw = (result.text || '').trim();
  // Try to find JSON in the response
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

/**
 * Detect whether a chat message describes an API issue.
 * Returns a structured issue object, or null if not a real issue.
 *
 * @param {object} msg - { text, channel_id, channel_name, user_id, thread_ts, workspace_id }
 * @param {object} opts - { sensitivity: 'low'|'medium'|'high', useAi: boolean, fetchImpl, anthropicCall }
 */
export async function detectIssue(msg, opts = {}) {
  const { text } = msg;
  if (!text || typeof text !== 'string' || text.length < 4) return null;
  const sensitivity = opts.sensitivity || 'medium';
  const useAi = opts.useAi !== false && !!process.env.ANTHROPIC_API_KEY;

  const heuristic = looksApiRelated(text);

  // Low sensitivity: require both heuristic AND strong signals (status code or URL)
  // Medium: require heuristic
  // High: classify everything
  if (sensitivity === 'low' && !(heuristic && (URL_RE.test(text) || STATUS_RE.test(text)))) {
    return null;
  }
  if (sensitivity === 'medium' && !heuristic) {
    return null;
  }

  const quick = quickExtract(text);

  // Contextual reference fallback — try to link to a recent issue on the same channel
  const isContextual = CONTEXTUAL_REFERENCES.some(re => re.test(text));
  if (isContextual && !quick.endpoint && !quick.url && msg.channel_id) {
    const recent = await findRecentIssueByEndpoint({
      workspace_id: msg.workspace_id,
      channel_id: msg.channel_id,
      endpoint: null,
      withinMinutes: 60,
    }).catch(() => null);
    if (recent) {
      quick.endpoint = recent.endpoint;
      quick.method = recent.method;
      quick.linked_issue_id = recent.id;
    }
  }

  let aiResult = null;
  if (useAi) {
    try {
      aiResult = await classifyWithAi(text, opts);
    } catch (err) {
      // AI failure shouldn't block heuristic-only detection
      aiResult = null;
    }
  }

  if (aiResult && aiResult.is_api_issue === false && aiResult.confidence === 'high') {
    return null;
  }

  // Require either AI confirmation or strong heuristic signals
  const strongSignal = !!(quick.url || quick.errorCode || isContextual || (aiResult && aiResult.is_api_issue));
  if (!strongSignal && sensitivity !== 'high') return null;

  return {
    workspace_id: msg.workspace_id || null,
    channel_type: msg.channel_type || 'slack',
    channel_id: msg.channel_id || null,
    channel_name: msg.channel_name || null,
    thread_ts: msg.thread_ts || null,
    user_id: msg.user_id || null,
    message_text: text,
    endpoint: aiResult?.endpoint || quick.endpoint || null,
    method: (aiResult?.method || quick.method || null)?.toUpperCase?.() || aiResult?.method || quick.method || null,
    error_code: aiResult?.status_code || quick.errorCode || null,
    error_description: aiResult?.error_description || null,
    url: quick.url || null,
    confidence: aiResult?.confidence || (quick.url || quick.errorCode ? 'medium' : 'low'),
    linked_issue_id: quick.linked_issue_id || null,
  };
}
