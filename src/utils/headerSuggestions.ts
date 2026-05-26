/* ============================================================================
 * Auto-suggested headers and params for the request builder.
 *
 * Three sources, fed in priority order:
 *   1. Method-based defaults — Content-Type for write methods, Accept on GET.
 *   2. Host heuristics — well-known APIs (GitHub, OpenAI, Stripe, etc.).
 *   3. Recent history — headers the user has actually used on this host.
 *
 * Each suggestion has a `source` + `why` so the UI can show provenance on hover.
 * Suggestions are passive: they render with an unchecked checkbox and a
 * de-emphasized style until the user activates them.
 * ========================================================================== */

import type { KeyValue, HistoryEntry, HttpMethod } from '../types';

export type SuggestionSource = 'method' | 'host' | 'history';

export interface HeaderSuggestion {
  id: string;
  field: 'headers';
  key: string;
  value: string;
  source: SuggestionSource;
  why: string;
}

/* -------- 1. Well-known API host patterns ---------------------------------- */

interface ApiPattern {
  label: string;
  hostMatch: RegExp;
  headers: { key: string; value: string; why: string }[];
}

const WELL_KNOWN_APIS: ApiPattern[] = [
  {
    label: 'GitHub',
    hostMatch: /(^|\.)api\.github\.com$/i,
    headers: [
      { key: 'Accept',                 value: 'application/vnd.github+json', why: 'GitHub recommends this Accept header' },
      { key: 'X-GitHub-Api-Version',   value: '2022-11-28',                  why: 'Pins the API version GitHub serves' },
      { key: 'Authorization',          value: 'Bearer ',                     why: 'Personal access token or fine-grained PAT' },
    ],
  },
  {
    label: 'OpenAI',
    hostMatch: /(^|\.)api\.openai\.com$/i,
    headers: [
      { key: 'Authorization',          value: 'Bearer ',                     why: 'OpenAI API key (sk-…)' },
      { key: 'Content-Type',           value: 'application/json',            why: 'Required for chat/completion bodies' },
      { key: 'OpenAI-Beta',            value: '',                            why: 'Set when calling beta endpoints' },
    ],
  },
  {
    label: 'Stripe',
    hostMatch: /(^|\.)api\.stripe\.com$/i,
    headers: [
      { key: 'Authorization',          value: 'Bearer ',                     why: 'Stripe secret key (sk_live_… / sk_test_…)' },
      { key: 'Stripe-Version',         value: '2024-06-20',                  why: 'Pins the Stripe API version' },
      { key: 'Idempotency-Key',        value: '',                            why: 'Recommended for POST to avoid duplicate charges' },
    ],
  },
  {
    label: 'Supabase',
    hostMatch: /(^|\.)supabase\.co$/i,
    headers: [
      { key: 'apikey',                 value: '',                            why: 'Supabase anon or service-role key' },
      { key: 'Authorization',          value: 'Bearer ',                     why: 'User JWT (or service-role key)' },
      { key: 'Content-Type',           value: 'application/json',            why: 'Required for PostgREST writes' },
    ],
  },
  {
    label: 'Anthropic',
    hostMatch: /(^|\.)api\.anthropic\.com$/i,
    headers: [
      { key: 'x-api-key',              value: '',                            why: 'Anthropic API key (sk-ant-…)' },
      { key: 'anthropic-version',      value: '2023-06-01',                  why: 'Pins the Anthropic API version' },
      { key: 'Content-Type',           value: 'application/json',            why: 'Required for /v1/messages' },
    ],
  },
  {
    label: 'Vercel',
    hostMatch: /(^|\.)vercel\.com$/i,
    headers: [
      { key: 'Authorization',          value: 'Bearer ',                     why: 'Vercel access token' },
    ],
  },
  {
    label: 'Razorpay',
    hostMatch: /(^|\.)razorpay\.com$/i,
    headers: [
      { key: 'Authorization',          value: 'Basic ',                      why: 'Base64(key_id:key_secret)' },
      { key: 'Content-Type',           value: 'application/json',            why: 'Required for write endpoints' },
    ],
  },
];

/* -------- 2. Suggestion builders ------------------------------------------ */

function hostOf(url: string): string | null {
  try { return new URL(url).host; } catch { return null; }
}

function methodSuggestions(method: HttpMethod): HeaderSuggestion[] {
  const out: HeaderSuggestion[] = [];
  if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
    out.push({
      id: `m:ct`,
      field: 'headers',
      key: 'Content-Type',
      value: 'application/json',
      source: 'method',
      why: `Standard body type for ${method} requests`,
    });
  }
  if (method === 'GET' || method === 'HEAD') {
    out.push({
      id: `m:accept`,
      field: 'headers',
      key: 'Accept',
      value: 'application/json',
      source: 'method',
      why: 'Ask the server for a JSON response',
    });
  }
  return out;
}

function hostSuggestions(url: string): HeaderSuggestion[] {
  const host = hostOf(url);
  if (!host) return [];
  const pattern = WELL_KNOWN_APIS.find(p => p.hostMatch.test(host));
  if (!pattern) return [];
  return pattern.headers.map((h, i) => ({
    id: `h:${pattern.label}:${i}`,
    field: 'headers',
    key: h.key,
    value: h.value,
    source: 'host',
    why: `${pattern.label} pattern · ${h.why}`,
  }));
}

function historySuggestions(url: string, history: HistoryEntry[], limit = 3): HeaderSuggestion[] {
  const host = hostOf(url);
  if (!host) return [];
  const counts = new Map<string, { count: number; value: string }>();
  for (const entry of history) {
    const ehost = hostOf(entry.request.url);
    if (!ehost || ehost.toLowerCase() !== host.toLowerCase()) continue;
    for (const h of entry.request.headers) {
      if (!h.enabled || !h.key) continue;
      const cur = counts.get(h.key) || { count: 0, value: h.value };
      cur.count += 1;
      // Keep the most recent value
      cur.value = h.value;
      counts.set(h.key, cur);
    }
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, limit)
    .map(([key, { count, value }], i) => ({
      id: `r:${i}:${key}`,
      field: 'headers',
      key,
      value,
      source: 'history',
      why: `Used ${count} time${count === 1 ? '' : 's'} on ${host}`,
    }));
}

/* -------- 3. Public API --------------------------------------------------- */

/** Build the merged, deduped suggestion list for the current request.
 *  - Existing keys (case-insensitive) are filtered out so we don't suggest a
 *    header the user already has.
 *  - Priority: method > host > history. The first occurrence of each key wins.
 *  - Dismissed IDs (passed in via `dismissed`) are skipped — the user clicked
 *    "Clear suggestions" on this batch.
 */
export function buildHeaderSuggestions(
  method: HttpMethod,
  url: string,
  existingHeaders: KeyValue[],
  history: HistoryEntry[],
  dismissed: ReadonlySet<string> = new Set(),
): HeaderSuggestion[] {
  const present = new Set(existingHeaders.map(h => h.key.trim().toLowerCase()).filter(Boolean));
  const seen = new Set<string>();
  const ordered: HeaderSuggestion[] = [];

  // Host suggestions are more specific than method defaults — they win on
  // ties. Example: GitHub's 'Accept: application/vnd.github+json' should
  // beat the generic 'Accept: application/json' from the method layer.
  const layers = [
    hostSuggestions(url),
    methodSuggestions(method),
    historySuggestions(url, history, 3),
  ];

  for (const layer of layers) {
    for (const s of layer) {
      const k = s.key.toLowerCase();
      if (present.has(k)) continue;
      if (seen.has(k)) continue;
      if (dismissed.has(s.id)) continue;
      seen.add(k);
      ordered.push(s);
    }
  }
  return ordered;
}
