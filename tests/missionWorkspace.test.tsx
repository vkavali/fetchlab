// @vitest-environment jsdom
import React from 'react';
import { webcrypto } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import MissionWorkspace from '../src/components/MissionWorkspace';
import { loadLocalMissions, type ProductMission } from '../src/product/missions';

const authFetch = vi.hoisted(() => vi.fn());
const authState = vi.hoisted(() => ({
  activeWorkspaceId: null as string | null,
  serverEnabled: false,
  user: null as null | { id: string; email: string; name: string; role: string },
  workspaces: [] as Array<{ id: string; name: string; owner_id: string; member_role: string }>,
}));

vi.mock('../src/auth/useAuth', () => ({
  useAuth: () => ({
    authFetch,
    ...authState,
  }),
}));

function jsonResponse(value: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  }));
}

function mission(status: ProductMission['status'] = 'draft'): ProductMission {
  return {
    id: 'mission-1',
    workspace_id: 'workspace-1',
    created_by: 'user-1',
    title: 'Checkout total breaks after a discount',
    status,
    proposal_hash: null,
    data: {
      input: {
        title: 'Checkout total breaks after a discount',
        outcome: 'Customers can complete discounted checkout.',
        evidence: 'Support case 443: applying SAVE20 changes the checkout total to NaN.',
        repository: 'acme/store',
        app_url: 'https://staging.example.com/checkout',
        source_type: 'customer_issue',
      },
      investigation: null,
      proposal: null,
      approval: null,
      pull_request: null,
      validation: null,
      last_error: null,
    },
    created_at: '2026-09-03T10:00:00.000Z',
    updated_at: '2026-09-03T10:00:00.000Z',
  };
}

describe('Product Missions workspace', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: webcrypto,
    });
    localStorage.clear();
    authState.activeWorkspaceId = null;
    authState.serverEnabled = false;
    authState.user = null;
    authState.workspaces = [];
    authFetch.mockReset();
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it('captures a real local mission in encrypted storage without claiming execution', async () => {
    render(<MissionWorkspace onSignIn={() => undefined} />);

    expect(await screen.findByRole('heading', { name: 'What product outcome should FetchLab own?' })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Mission title'), {
      target: { value: 'Checkout total breaks after a discount' },
    });
    fireEvent.change(screen.getByLabelText('Real customer evidence'), {
      target: { value: 'Support case 443: applying SAVE20 changes the checkout total to NaN.' },
    });
    fireEvent.change(screen.getByLabelText('Desired outcome'), {
      target: { value: 'Customers can complete discounted checkout.' },
    });
    fireEvent.change(screen.getByLabelText('GitHub repository'), {
      target: { value: 'acme/store' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save mission' }));

    expect(await screen.findByText('Mission encrypted and saved on this device. Sign in to investigate the repository.')).toBeTruthy();
    const stored = localStorage.getItem('fetchlab_product_missions_v1');
    expect(stored).toMatch(/^v1:/);
    expect(stored).not.toContain('Support case 443');
    await expect(loadLocalMissions()).resolves.toMatchObject([{
      title: 'Checkout total breaks after a discount',
      status: 'draft',
    }]);
    expect(screen.queryByText('Investigation completed.')).toBeNull();
  });

  it('renders server configuration truthfully and starts investigation from a saved mission', async () => {
    authState.activeWorkspaceId = 'workspace-1';
    authState.serverEnabled = true;
    authState.user = { id: 'user-1', email: 'owner@example.com', name: 'Owner', role: 'admin' };
    authState.workspaces = [{ id: 'workspace-1', name: 'Personal', owner_id: 'user-1', member_role: 'admin' }];
    const savedMission = mission();
    const investigatedMission: ProductMission = {
      ...savedMission,
      status: 'needs_input',
      data: {
        ...savedMission.data,
        investigation: {
          repository: 'acme/store',
          questions: ['Which browser and discount sequence reproduces the issue?'],
        },
      },
    };

    authFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (url.endsWith('/missions/config')) {
        return jsonResponse({
          github: { configured: true, default_repository: 'acme/store', ready: true },
          ai: { configured: true, provider: 'anthropic', source: 'workspace' },
          guarantees: { creates_draft_pr: true, merges: false, deploys: false },
        });
      }
      if (url.endsWith('/missions') && !init?.method) return jsonResponse({ missions: [savedMission] });
      if (url.endsWith('/missions/mission-1') && !init?.method) {
        return jsonResponse({ mission: savedMission, events: [] });
      }
      if (url.endsWith('/missions/mission-1/investigate') && init?.method === 'POST') {
        return jsonResponse({ mission: investigatedMission, events: [] });
      }
      return jsonResponse({ error: `Unexpected request: ${url}` }, 500);
    });

    render(<MissionWorkspace />);

    expect(await screen.findByRole('heading', { name: savedMission.title })).toBeTruthy();
    expect(screen.getByText('anthropic via workspace')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Investigate repository' }));
    expect(await screen.findByText('More evidence required')).toBeTruthy();
    expect(screen.getByText('Which browser and discount sequence reproduces the issue?')).toBeTruthy();
    await waitFor(() => expect(authFetch).toHaveBeenCalledWith(
      '/api/workspaces/workspace-1/missions/mission-1/investigate',
      { method: 'POST', body: undefined },
    ));
  });

  it('lets a workspace admin verify and save a GitHub connection', async () => {
    authState.activeWorkspaceId = 'workspace-1';
    authState.serverEnabled = true;
    authState.user = { id: 'user-1', email: 'owner@example.com', name: 'Owner', role: 'admin' };
    authState.workspaces = [{ id: 'workspace-1', name: 'Personal', owner_id: 'user-1', member_role: 'admin' }];
    const savedMission = mission();
    authFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (url.endsWith('/missions/config/github') && init?.method === 'PUT') {
        return jsonResponse({
          github: {
            configured: true,
            default_repository: 'acme/store',
            ready: true,
            source: 'workspace',
            token_preview: 'gith...6789',
          },
        });
      }
      if (url.endsWith('/missions/config')) {
        return jsonResponse({
          github: { configured: false, default_repository: '', ready: false, source: 'none' },
          ai: { configured: false, provider: 'local', source: 'server' },
          guarantees: { creates_draft_pr: true, merges: false, deploys: false },
        });
      }
      if (url.endsWith('/missions') && !init?.method) return jsonResponse({ missions: [savedMission] });
      if (url.endsWith('/missions/mission-1') && !init?.method) return jsonResponse({ mission: savedMission, events: [] });
      return jsonResponse({ error: `Unexpected request: ${url}` }, 500);
    });

    render(<MissionWorkspace />);
    expect(await screen.findByRole('heading', { name: savedMission.title })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Connect GitHub repository' }));
    fireEvent.change(screen.getByLabelText('Repository'), { target: { value: 'acme/store' } });
    fireEvent.change(screen.getByLabelText('Fine-grained access token'), {
      target: { value: 'github_pat_abcdefghijklmnopqrstuvwxyz123456789' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Verify and save' }));

    expect(await screen.findByText('GitHub access verified and encrypted for this workspace.')).toBeTruthy();
    expect(authFetch).toHaveBeenCalledWith(
      '/api/workspaces/workspace-1/missions/config/github',
      {
        method: 'PUT',
        body: JSON.stringify({
          token: 'github_pat_abcdefghijklmnopqrstuvwxyz123456789',
          repository: 'acme/store',
        }),
      },
    );
    expect(screen.getByText('acme/store via workspace credential')).toBeTruthy();
  });
});
