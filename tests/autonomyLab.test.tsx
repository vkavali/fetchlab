// @vitest-environment jsdom
import React, { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import AutonomyLab from '../src/components/AutonomyLab';

const writeText = vi.hoisted(() => vi.fn(async () => undefined));
const authFetch = vi.hoisted(() => vi.fn());
const authState = vi.hoisted(() => ({
  activeWorkspaceId: null as string | null,
  serverEnabled: false,
  user: null as null | { id: string; email: string; name: string; role: string },
}));

vi.mock('../src/auth/useAuth', () => ({
  useAuth: () => ({
    authFetch,
    ...authState,
  }),
}));

vi.mock('../src/store/useApp', () => ({
  useApp: () => ({
    state: {
      activeTabId: 'tab-1',
      tabs: [{ id: 'tab-1', requestId: 'req-1', name: 'Issue refund', method: 'POST', isDirty: false }],
      requests: {
        'req-1': {
          id: 'req-1',
          name: 'Issue refund',
          method: 'POST',
          url: 'https://api.example.com/refunds?api_key=query-secret',
          params: [],
          headers: [{ id: 'h1', key: 'Authorization', value: 'Bearer top-secret', enabled: true }],
          body: { type: 'json', content: '{"api_key":"body-secret"}', formData: [] },
          auth: { type: 'bearer', bearer: { token: 'top-secret' } },
        },
      },
      responses: {
        'req-1': {
          status: 200,
          statusText: 'OK',
          headers: { 'content-type': 'application/json' },
          body: '{"refunded":true}',
          size: 17,
          time: 184,
          contentType: 'application/json',
        },
      },
    },
  }),
}));

describe('AutonomyLab', () => {
  beforeEach(() => {
    authState.activeWorkspaceId = null;
    authState.serverEnabled = false;
    authState.user = null;
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    writeText.mockClear();
    authFetch.mockClear();
  });

  it('moves from workflow scope to evidence and a Tunnel-ready contract without persisting credentials', async () => {
    render(
      <AutonomyLab
        onClose={() => undefined}
        onOpenAdvanced={() => undefined}
        onOpenRequestBuilder={() => undefined}
      />,
    );

    expect(await screen.findByText('What work should the AI own?')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Workflow'), {
      target: { value: 'Review a refund exception and update the billing ledger.' },
    });
    fireEvent.change(screen.getByLabelText('Target users'), {
      target: { value: 'Support leads' },
    });
    fireEvent.change(screen.getByLabelText('Decision owner'), {
      target: { value: 'Revenue operations' },
    });
    fireEvent.change(screen.getByLabelText('Successful outcome'), {
      target: { value: 'The approved refund appears in the billing ledger.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Attach current API' }));

    fireEvent.click(screen.getByRole('button', { name: /Authority/ }));
    fireEvent.click(screen.getByRole('radio', { name: /Bounded autonomous/ }));
    expect(screen.getByText('Owner selected: Autonomous')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /^Pilot$/ }));
    expect(screen.getByText('Synthetic rehearsal is non-authorizing')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Run synthetic rehearsal' }));

    await waitFor(() => {
      expect(screen.getAllByText('Simulated')).toHaveLength(20);
    });

    fireEvent.change(screen.getByLabelText('Evidence note'), {
      target: { value: 'Reviewer confirmed the ledger state.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add pilot observation' }));
    expect(await screen.findByText('Reviewer confirmed the ledger state.')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Contract/ }));
    expect(screen.getByText('Autonomy contract')).toBeTruthy();
    expect(document.body.textContent).toContain('fetchlab.autonomy-contract');
    expect((screen.getByRole('button', { name: 'Mark decision final' }) as HTMLButtonElement).disabled).toBe(false);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy Tunnel task' }));
    });
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText.mock.calls[0][0]).toContain('agent-tunnel.task');
    expect(writeText.mock.calls[0][0]).toContain('Do not increase the selected autonomy level');

    await waitFor(() => {
      const stored = localStorage.getItem('fetchlab_autonomy_studies_v1:local') || '';
      expect(stored).toContain('https://api.example.com/refunds?api_key=[redacted]');
      expect(stored).not.toContain('top-secret');
      expect(stored).not.toContain('body-secret');
      expect(stored).not.toContain('query-secret');
    });
  });

  it('saves a signed workspace study before creating a Tunnel task', async () => {
    authState.activeWorkspaceId = 'workspace-1';
    authState.serverEnabled = true;
    authState.user = { id: 'user-1', email: 'owner@example.com', name: 'Owner', role: 'admin' };
    authFetch.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path.endsWith('/tunnel')) {
        return new Response(JSON.stringify({ task_id: 'tunnel-task-42' }), {
          status: 200, headers: { 'Content-Type': 'application/json' },
        });
      }
      if (init?.method === 'POST') {
        const body = JSON.parse(String(init.body));
        return new Response(JSON.stringify({
          study: {
            id: body.id,
            name: body.name,
            status: body.status,
            data: body.data,
          },
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({ studies: [] }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      });
    });

    render(
      <AutonomyLab
        onClose={() => undefined}
        onOpenAdvanced={() => undefined}
        onOpenRequestBuilder={() => undefined}
      />,
    );

    await screen.findByText('What work should the AI own?');
    fireEvent.click(screen.getByRole('button', { name: /Contract/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Send to Tunnel' }));

    expect(await screen.findByText('Tunnel task tunnel-task-42 created')).toBeTruthy();
    const paths = authFetch.mock.calls.map(call => call[0]);
    expect(paths.some(path => path.endsWith('/autonomy-studies'))).toBe(true);
    expect(paths.some(path => path.endsWith('/tunnel'))).toBe(true);
  });
  it('opens advanced tools from the primary lab surface', async () => {
    const onOpenAdvanced = vi.fn();
    render(
      <AutonomyLab
        onClose={() => undefined}
        onOpenAdvanced={onOpenAdvanced}
        onOpenRequestBuilder={() => undefined}
      />,
    );

    await screen.findByText('What work should the AI own?');
    fireEvent.click(screen.getByRole('button', { name: 'Advanced tools' }));
    expect(onOpenAdvanced).toHaveBeenCalledTimes(1);
  });
});
