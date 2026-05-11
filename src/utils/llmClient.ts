// Client-side LLM utility. Two modes:
//   1. Server-side (default): call /api/ai/* on the FetchLab backend.
//      The server uses the user's BYOK config (or its own default) to talk
//      to the actual LLM. This is the standard path.
//   2. Client-side (opt-in): if the user enables "Run AI locally" in LLM
//      Settings AND we're running in the desktop/Tauri build, call the LLM
//      provider directly from this code so the server never sees the data.
//
// Both modes share the same interface so callers don't need to care.

export type ProviderType = 'anthropic' | 'bedrock' | 'vertex' | 'openai' | 'local';

export interface ClientLLMConfig {
  provider: ProviderType;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  region?: string;
  projectId?: string;
  location?: string;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatResult {
  content: string;
  model?: string;
  provider: ProviderType | 'server';
}

const STORAGE_KEY = 'fetchlab_llm_clientside';
const CONFIG_KEY = 'fetchlab_llm_client_config';

export function isClientSideEnabled(): boolean {
  try {
    if (localStorage.getItem(STORAGE_KEY) !== '1') return false;
    return isDesktopApp();
  } catch {
    return false;
  }
}

// Detect Tauri / desktop build. window.__TAURI__ is set in Tauri runtime.
export function isDesktopApp(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as unknown as { __TAURI__?: unknown; __TAURI_IPC__?: unknown };
  return !!(w.__TAURI__ || w.__TAURI_IPC__);
}

export function getClientConfig(): ClientLLMConfig | null {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) return null;
    const cfg = JSON.parse(raw);
    if (!cfg.provider) return null;
    return cfg as ClientLLMConfig;
  } catch {
    return null;
  }
}

export function setClientConfig(cfg: ClientLLMConfig | null) {
  try {
    if (cfg) localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
    else localStorage.removeItem(CONFIG_KEY);
  } catch { /* ignore */ }
}

// Direct call to an LLM provider from the browser/desktop. Used only when
// `isClientSideEnabled()` returns true and the user has supplied a client
// config. For non-Anthropic providers we use the OpenAI-compatible REST shape,
// which works for most enterprise gateways.
export async function chatDirect(messages: ChatMessage[], opts: { maxTokens?: number; system?: string } = {}): Promise<ChatResult> {
  const cfg = getClientConfig();
  if (!cfg) throw new Error('No client-side LLM config set');

  if (cfg.provider === 'local') {
    return { content: 'Local provider (client-side) — no model output.', provider: 'local', model: 'local-heuristic' };
  }
  if (cfg.provider === 'anthropic') {
    return chatAnthropicDirect(cfg, messages, opts);
  }
  // Bedrock and Vertex require AWS/GCP signing — not safe to do from the browser
  // without a proxy. We fall back to server-side for those.
  if (cfg.provider === 'bedrock' || cfg.provider === 'vertex') {
    throw new Error(`${cfg.provider} client-side calls require the server-side proxy`);
  }
  // openai-compatible
  return chatOpenAIDirect(cfg, messages, opts);
}

async function chatAnthropicDirect(cfg: ClientLLMConfig, messages: ChatMessage[], opts: { maxTokens?: number; system?: string }): Promise<ChatResult> {
  if (!cfg.apiKey) throw new Error('Anthropic API key required for client-side calls');
  const systemMsgs = messages.filter(m => m.role === 'system').map(m => m.content);
  const rest = messages.filter(m => m.role !== 'system');
  const system = opts.system || systemMsgs.join('\n\n');
  const body: Record<string, unknown> = {
    model: cfg.model || 'claude-sonnet-4-6',
    max_tokens: opts.maxTokens ?? 1024,
    messages: rest,
  };
  if (system) body.system = system;
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': cfg.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `Anthropic error ${res.status}`);
  const content = Array.isArray(data.content)
    ? data.content.filter((c: { type: string }) => c.type === 'text').map((c: { text: string }) => c.text).join('\n')
    : '';
  return { content, model: data.model, provider: 'anthropic' };
}

async function chatOpenAIDirect(cfg: ClientLLMConfig, messages: ChatMessage[], opts: { maxTokens?: number; system?: string }): Promise<ChatResult> {
  const baseUrl = (cfg.baseUrl || 'https://api.openai.com/v1').replace(/\/$/, '');
  const all = opts.system ? [{ role: 'system' as const, content: opts.system }, ...messages] : messages;
  const body: Record<string, unknown> = {
    model: cfg.model || 'gpt-4o-mini',
    messages: all,
    max_tokens: opts.maxTokens ?? 1024,
  };
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (cfg.apiKey) headers.Authorization = `Bearer ${cfg.apiKey}`;
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `OpenAI-compat error ${res.status}`);
  const content = data.choices?.[0]?.message?.content || '';
  return { content, model: data.model, provider: 'openai' };
}

// Unified chat — picks client-side or server-side based on user settings.
// Falls back to server-side on any client-side failure (path: serverPath).
export async function chat(messages: ChatMessage[], opts: { maxTokens?: number; system?: string; serverPath?: string; serverBody?: unknown } = {}): Promise<ChatResult> {
  if (isClientSideEnabled() && getClientConfig()) {
    try {
      return await chatDirect(messages, opts);
    } catch (err) {
      console.warn('[llmClient] client-side call failed, falling back to server:', err);
    }
  }
  // Server fallback — caller supplies the path + body since each AI endpoint
  // has a different shape.
  if (!opts.serverPath) {
    throw new Error('Server fallback requires serverPath');
  }
  const res = await fetch(opts.serverPath, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(opts.serverBody ?? {}),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || data?.message || `Request failed (${res.status})`);
  return { content: typeof data === 'string' ? data : JSON.stringify(data), provider: 'server' };
}
