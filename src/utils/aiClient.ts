import { authFetch } from './apiClient';
import { apiUrl } from './apiBase';

let cachedStatus: { enabled: boolean; model: string } | null = null;

export async function getAiStatus(): Promise<{ enabled: boolean; model: string }> {
  if (cachedStatus) return cachedStatus;
  try {
    const res = await fetch(apiUrl('/api/ai/status'), { credentials: 'include' });
    if (!res.ok) {
      cachedStatus = { enabled: false, model: '' };
      return cachedStatus;
    }
    const data = await res.json();
    cachedStatus = { enabled: !!data.enabled, model: data.model || '' };
    return cachedStatus;
  } catch {
    cachedStatus = { enabled: false, model: '' };
    return cachedStatus;
  }
}

export async function aiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await authFetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let message = `AI request failed (${res.status})`;
    try {
      const data = await res.json();
      if (data?.message) message = data.message;
      else if (data?.error) message = data.error;
    } catch { /* not JSON */ }
    throw new Error(message);
  }
  return (await res.json()) as T;
}

export interface AiRequestSpec {
  method?: string;
  url?: string;
  headers?: { key: string; value: string }[];
  params?: { key: string; value: string }[];
  body?: { type?: string; content?: string };
  name?: string;
}

export interface AiDiagnosis {
  summary: string;
  severity: 'critical' | 'warning' | 'info';
  likelyCause: string;
  fixes: { title: string; detail: string; code?: string }[];
}

export interface AiDiffExplanation {
  summary: string;
  breaking: boolean;
  breakingReason: string;
  highlights: { change: string; impact: string }[];
}
