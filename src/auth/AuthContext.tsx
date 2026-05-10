import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  totp_enabled?: boolean;
}

export interface Workspace {
  id: string;
  name: string;
  owner_id: string;
  member_role?: string;
  created_at?: string;
}

export interface LoginResult {
  twofa_required?: boolean;
  pending_token?: string;
  user?: AuthUser;
}

interface AuthContextValue {
  user: AuthUser | null;
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  setActiveWorkspaceId: (id: string | null) => void;
  loading: boolean;
  serverEnabled: boolean;
  login: (email: string, password: string) => Promise<LoginResult>;
  loginVerify2fa: (args: { code?: string; recovery_code?: string; pending_token?: string }) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  authFetch: (input: string, init?: RequestInit) => Promise<Response>;
}

const TOKEN_KEY = 'fetchlab_jwt';
const ACTIVE_WS_KEY = 'fetchlab_active_workspace';

const AuthContext = createContext<AuthContextValue | null>(null);

async function probeServer(): Promise<boolean> {
  try {
    const res = await fetch('/api/health', { cache: 'no-store' });
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
    return fetch(input, { ...init, headers, credentials: 'include' });
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
      const ok = await probeServer();
      setServerEnabled(ok);
      if (ok) await refresh();
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (email: string, password: string): Promise<LoginResult> => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      credentials: 'include',
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');
    if (data.twofa_required) {
      return { twofa_required: true, pending_token: data.pending_token };
    }
    setToken(data.token);
    setUser(data.user);
    await refresh();
    return { user: data.user };
  };

  const loginVerify2fa = async ({ code, recovery_code, pending_token }: { code?: string; recovery_code?: string; pending_token?: string }) => {
    const res = await fetch('/api/auth/login/2fa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, recovery_code, pending_token }),
      credentials: 'include',
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '2FA verification failed');
    setToken(data.token);
    setUser(data.user);
    await refresh();
  };

  const register = async (email: string, password: string, name?: string) => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name }),
      credentials: 'include',
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Registration failed');
    setToken(data.token);
    setUser(data.user);
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
      value={{ user, workspaces, activeWorkspaceId, setActiveWorkspaceId, loading, serverEnabled, login, loginVerify2fa, register, logout, refresh, authFetch }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
