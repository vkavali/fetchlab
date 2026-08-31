import { useEffect, useState, type ReactNode } from 'react';
import { AuthContext, type AuthUser, type LoginResult, type Workspace } from './useAuth';
import { apiUrl } from '../utils/apiBase';
import { parseAuthResponse } from './authResponse';

const TOKEN_KEY = 'fetchlab_jwt';
const ACTIVE_WS_KEY = 'fetchlab_active_workspace';
const TRIAL_START_KEY = 'fetchlab_trial_start';
const TRIAL_DAYS = 30;
const TRIAL_MS = TRIAL_DAYS * 24 * 60 * 60 * 1000;

function readOrInitTrialStart(): number {
  try {
    const existing = localStorage.getItem(TRIAL_START_KEY);
    if (existing) {
      const n = parseInt(existing, 10);
      if (Number.isFinite(n) && n > 0) return n;
    }
    const now = Date.now();
    localStorage.setItem(TRIAL_START_KEY, String(now));
    return now;
  } catch {
    return Date.now();
  }
}

async function probeServer(): Promise<boolean> {
  // In Tauri or file:// context, there's no server — skip probe entirely
  const proto = window.location.protocol;
  if (proto === 'tauri:' || proto === 'file:' || proto === 'https:' && window.location.hostname === 'tauri.localhost') {
    return false;
  }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000); // 3s timeout
    const res = await fetch(apiUrl('/api/health'), { cache: 'no-store', signal: controller.signal, credentials: 'include' });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceIdState] = useState<string | null>(() => {
    try { return localStorage.getItem(ACTIVE_WS_KEY); } catch { return null; }
  });
  const [loading, setLoading] = useState(true);
  const [serverEnabled, setServerEnabled] = useState(false);
  const [trialStart, setTrialStart] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const elapsed = trialStart != null ? Math.max(0, now - trialStart) : 0;
  const trialRemainingMs = trialStart != null ? Math.max(0, TRIAL_MS - elapsed) : TRIAL_MS;
  const trialDaysRemaining = trialStart != null
    ? Math.max(0, Math.min(TRIAL_DAYS, Math.ceil(trialRemainingMs / (24 * 60 * 60 * 1000))))
    : TRIAL_DAYS;
  const trialEnded = trialStart != null && elapsed >= TRIAL_MS;
  const trialActive = trialStart != null && !trialEnded;

  const setActiveWorkspaceId = (id: string | null) => {
    setActiveWorkspaceIdState(id);
    try {
      if (id) localStorage.setItem(ACTIVE_WS_KEY, id);
      else localStorage.removeItem(ACTIVE_WS_KEY);
    } catch { /* ignore */ }
  };

  const getToken = () => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } };
  const setToken = (t: string | null) => {
    try { if (t) localStorage.setItem(TOKEN_KEY, t); else localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ }
  };

  const authFetch = async (input: string, init: RequestInit = {}) => {
    const token = getToken();
    const headers = new Headers(init.headers || {});
    if (token) headers.set('Authorization', `Bearer ${token}`);
    if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    try {
      return await fetch(apiUrl(input), { ...init, headers, credentials: 'include' });
    } catch {
      return new Response(JSON.stringify({ error: 'Server unreachable' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  };

  const refresh = async () => {
    const token = getToken();
    if (!token) { setUser(null); setWorkspaces([]); return; }
    try {
      const res = await authFetch('/api/auth/me');
      if (!res.ok) {
        setUser(null); setToken(null); setWorkspaces([]);
        return;
      }
      const data = await res.json();
      setUser(data.user);
      setWorkspaces(data.workspaces || []);
      if (!activeWorkspaceId && data.workspaces?.[0]) {
        setActiveWorkspaceId(data.workspaces[0].id);
      }
    } catch {
      setUser(null); setToken(null); setWorkspaces([]);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const ok = await probeServer();
        setServerEnabled(ok);
        if (ok) {
          try { await refresh(); } catch { /* guest mode */ }
        }
      } catch {
        setServerEnabled(false);
      }
      try {
        if (!getToken()) {
          setTrialStart(readOrInitTrialStart());
        }
      } catch {
        setTrialStart(Date.now());
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (email: string, password: string): Promise<LoginResult> => {
    let res: Response;
    try {
      res = await fetch(apiUrl('/api/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        credentials: 'include',
      });
    } catch {
      throw new Error('Login unavailable - cannot reach API server');
    }
    const data = await parseAuthResponse(res, 'Login');
    if (data.twofa_required) {
      return { twofa_required: true, pending_token: data.pending_token as string | undefined };
    }
    setToken(data.token as string);
    setUser(data.user as AuthUser);
    await refresh();
    return { user: data.user as AuthUser };
  };

  const loginVerify2fa = async ({ code, recovery_code, pending_token }: { code?: string; recovery_code?: string; pending_token?: string }) => {
    let res: Response;
    try {
      res = await fetch(apiUrl('/api/auth/login/2fa'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, recovery_code, pending_token }),
        credentials: 'include',
      });
    } catch {
      throw new Error('2FA verification unavailable - cannot reach API server');
    }
    const data = await parseAuthResponse(res, 'Login');
    setToken(data.token as string);
    setUser(data.user as AuthUser);
    await refresh();
  };

  const register = async (email: string, password: string, name?: string) => {
    let res: Response;
    try {
      res = await fetch(apiUrl('/api/auth/register'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name }),
        credentials: 'include',
      });
    } catch {
      throw new Error('Registration unavailable - cannot reach API server');
    }
    const data = await parseAuthResponse(res, 'Registration');
    setToken(data.token as string);
    setUser(data.user as AuthUser);
    await refresh();
  };

  const logout = async () => {
    try { await authFetch('/api/auth/logout', { method: 'POST' }); } catch { /* ignore */ }
    setToken(null);
    setUser(null);
    setWorkspaces([]);
    setActiveWorkspaceId(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, workspaces, activeWorkspaceId, setActiveWorkspaceId, loading, serverEnabled, trialActive, trialDaysRemaining, trialEnded, login, loginVerify2fa, register, logout, refresh, authFetch }}
    >
      {children}
    </AuthContext.Provider>
  );
}
