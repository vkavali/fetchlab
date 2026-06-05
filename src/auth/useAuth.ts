import { createContext, useContext } from 'react';

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

export interface AuthContextValue {
  user: AuthUser | null;
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  setActiveWorkspaceId: (id: string | null) => void;
  loading: boolean;
  serverEnabled: boolean;
  trialActive: boolean;
  trialDaysRemaining: number;
  trialEnded: boolean;
  login: (email: string, password: string) => Promise<LoginResult>;
  loginVerify2fa: (args: { code?: string; recovery_code?: string; pending_token?: string }) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  authFetch: (input: string, init?: RequestInit) => Promise<Response>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

