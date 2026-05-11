// Shared authenticated fetch helper. Reads the JWT from the same localStorage
// key the AuthContext writes to, so all API calls flow through here and stay
// authenticated even outside React contexts.
const TOKEN_KEY = 'fetchlab_jwt';

function getToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}

export async function authFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const headers = new Headers(init.headers || {});
  if (token && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);
  return fetch(input, { ...init, headers, credentials: 'include' });
}

export async function authJson<T>(input: string, init: RequestInit = {}): Promise<T> {
  const res = await authFetch(input, init);
  const text = await res.text();
  let data: unknown;
  try { data = text ? JSON.parse(text) : {}; } catch { data = text; }
  if (!res.ok) {
    const errMsg = (data as { error?: string; message?: string })?.error
      || (data as { error?: string; message?: string })?.message
      || `Request failed (${res.status})`;
    throw new Error(errMsg);
  }
  return data as T;
}
