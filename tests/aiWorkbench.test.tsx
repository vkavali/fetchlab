// @vitest-environment jsdom
import React, { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import AIWorkbench from '../src/components/AIWorkbench';

const authFetch = vi.hoisted(() => vi.fn(async (path: string) => {
  if (path.includes('/api/settings/llm')) {
    return new Response(JSON.stringify({
      config: { provider: 'local', has_api_key: false, model_id: 'local-heuristic' },
      active_provider: 'local',
      active_source: 'byok',
      server_default: { provider: 'local', configured: true },
      providers: ['anthropic', 'openai', 'bedrock', 'vertex', 'local'],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  return new Response(JSON.stringify({ aiEnabled: true, slackEnabled: false, githubEnabled: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}));

vi.mock('../src/auth/useAuth', () => ({
  useAuth: () => ({
    authFetch,
    activeWorkspaceId: 'workspace-1',
    user: { id: 'user-1', email: 'dev@example.com', role: 'admin' },
  }),
}));

vi.mock('../src/store/useApp', () => ({
  useApp: () => ({
    state: {
      activeTabId: 'tab-1',
      tabs: [{ id: 'tab-1', requestId: 'req-1', name: 'Get health', method: 'GET', isDirty: false }],
      requests: {
        'req-1': {
          id: 'req-1',
          name: 'Get health',
          method: 'GET',
          url: 'https://api.example.com/health',
          params: [],
          headers: [{ id: 'h1', key: 'Authorization', value: 'Bearer secret', enabled: true }],
          body: { type: 'none', content: '', formData: [] },
          auth: { type: 'bearer', bearer: { token: 'secret' } },
        },
      },
      responses: {
        'req-1': {
          status: 200,
          statusText: 'OK',
          headers: { 'content-type': 'application/json' },
          body: '{"ok":true,"version":"1.0"}',
          size: 27,
          time: 42,
          contentType: 'application/json',
        },
      },
      collections: [{ id: 'col-1', name: 'Core API', requests: [] }],
      history: [{ id: 'hist-1', timestamp: Date.now(), request: {}, response: null }],
    },
  }),
}));

describe('AIWorkbench', () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
    authFetch.mockClear();
  });

  it('renders the product workbench around active API context', async () => {
    const onOpenRequestBuilder = vi.fn();
    render(
      <AIWorkbench
        onClose={() => undefined}
        onOpenAgent={() => undefined}
        onOpenLlmSettings={() => undefined}
        onOpenSecurity={() => undefined}
        onOpenRequestBuilder={onOpenRequestBuilder}
      />
    );

    expect(screen.getByText('AI Workbench')).toBeTruthy();
    expect(screen.getAllByText('Prompt Lab').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Eval Lab').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Tool Builder').length).toBeGreaterThan(0);
    expect(screen.getByText('Create API Request')).toBeTruthy();
    expect(screen.getAllByText('Get health').length).toBeGreaterThan(0);
    expect(screen.getAllByText('200 42 ms').length).toBeGreaterThan(0);

    await act(async () => {
      fireEvent.click(screen.getByText('Create API Request'));
    });
    expect(onOpenRequestBuilder).toHaveBeenCalledTimes(1);

    await act(async () => {
      fireEvent.click(screen.getAllByText('Tool Builder')[0]);
    });
    expect(screen.getByText('OpenAI tool')).toBeTruthy();
    expect(screen.getByText('Secrets are redacted from generated agent artifacts.')).toBeTruthy();
  });
});
