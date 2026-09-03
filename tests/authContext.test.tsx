// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../src/auth/AuthContext';
import { useAuth } from '../src/auth/useAuth';

function Harness() {
  const { loading, login, serverEnabled, user, workspaces } = useAuth();
  if (loading) return <div>Loading auth</div>;
  return (
    <div>
      <button type="button" onClick={() => void login('pilot@fetchlab.test', 'password123')}>Log in</button>
      <div>Server: {serverEnabled ? 'online' : 'offline'}</div>
      <div>User: {user?.email || 'guest'}</div>
      <div>Workspace: {workspaces[0]?.name || 'none'}</div>
    </div>
  );
}

describe('AuthProvider server recovery', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('enters server-backed mode after login even when the startup health probe failed', async () => {
    const user = { id: 'user-1', email: 'pilot@fetchlab.test', name: 'Pilot', role: 'admin' };
    const workspace = { id: 'workspace-1', name: 'Personal', owner_id: user.id, member_role: 'admin' };
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/api/health')) throw new Error('cold start');
      if (url.endsWith('/api/auth/login')) {
        return new Response(JSON.stringify({ token: 'signed-token', user }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url.endsWith('/api/auth/me')) {
        return new Response(JSON.stringify({ user, workspaces: [workspace] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<AuthProvider><Harness /></AuthProvider>);
    expect(await screen.findByText('Server: offline')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Log in' }));

    await waitFor(() => {
      expect(screen.getByText('Server: online')).toBeTruthy();
      expect(screen.getByText('User: pilot@fetchlab.test')).toBeTruthy();
      expect(screen.getByText('Workspace: Personal')).toBeTruthy();
    });
    expect(localStorage.getItem('fetchlab_jwt')).toBe('signed-token');
  });
});
