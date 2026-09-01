// @vitest-environment jsdom
import React, { act } from 'react';
import { webcrypto } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import AutonomyLab from '../src/components/AutonomyLab';
import type {
  AuthorityCredential,
  AuthorityEvent,
  AuthorityPolicy,
  AuthorityState,
  LocalAuthorityGate,
} from '../src/utils/authorityClient';

const authFetch = vi.hoisted(() => vi.fn());
const saveEncryptedLocal = vi.hoisted(() => vi.fn());
const loadEncryptedLocal = vi.hoisted(() => vi.fn());
const vault = vi.hoisted(() => ({
  gates: [] as LocalAuthorityGate[],
  recovery: new Map<string, unknown>(),
}));
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

vi.mock('../src/utils/localVault', () => ({
  loadEncryptedLocal,
  saveEncryptedLocal,
}));

const publishedPolicy: AuthorityPolicy = {
  version: 1,
  mode: 'enforce',
  defaultDecision: 'deny',
  rules: [{
    id: 'refund-rule',
    name: 'Review refunds',
    enabled: true,
    effect: 'require_approval',
    toolPattern: 'stripe.refunds.create',
    operation: 'write',
    targetPattern: 'stripe://charges/*/refund',
    constraints: [{ path: 'amount', operator: 'lte', value: 100 }],
  }],
};

const draftPolicy: AuthorityPolicy = {
  ...publishedPolicy,
  rules: publishedPolicy.rules.map(rule => ({ ...rule, effect: 'allow' })),
};

const pendingEvent: AuthorityEvent = {
  event_id: 'event-1',
  study_id: 'gate-1',
  agent_id: 'refund-agent',
  session_id: 'run-42',
  action: {
    agent_id: 'refund-agent',
    session_id: 'run-42',
    tool: 'stripe.refunds.create',
    operation: 'write',
    target: 'stripe://charges/ch_123/refund',
    arguments: { amount: 75, api_key: '[encrypted]' },
    reversible: false,
  },
  action_hash: 'a'.repeat(64),
  decision: 'require_approval',
  execute: false,
  mode: 'enforce',
  reason: 'Matched Review refunds.',
  matched_rule_id: 'refund-rule',
  policy_revision: 1,
  policy_fingerprint: 'published-fingerprint',
  review_status: 'pending',
  approval_expires_at: null,
  consumed_at: null,
  created_at: '2026-09-01T12:00:00.000Z',
  source: 'runtime',
};

function makeRemoteState(): AuthorityState {
  return {
    study: {
      id: 'gate-1',
      name: 'Refund agent production',
      draft_policy: structuredClone(draftPolicy),
      published_revision: 1,
      updated_at: '2026-09-01T12:00:00.000Z',
    },
    draft_fingerprint: 'draft-fingerprint',
    published: {
      id: 'revision-1',
      revision: 1,
      fingerprint: 'published-fingerprint',
      policy: structuredClone(publishedPolicy),
      prior_fingerprint: null,
      published_by: 'user-1',
      created_at: '2026-09-01T11:00:00.000Z',
    },
    events: [structuredClone(pendingEvent)],
    diff: {
      rows: [{
        eventId: 'event-1',
        actionHash: pendingEvent.action_hash,
        previousDecision: 'require_approval',
        nextDecision: 'allow',
        previousRuleId: 'refund-rule',
        nextRuleId: 'refund-rule',
        change: 'expansion',
        review: null,
      }],
      expansion_count: 1,
      restriction_count: 0,
      unchanged_count: 0,
      unresolved_expansion_count: 1,
      evidence_complete: true,
      total_events: 1,
    },
  };
}

describe('Agent Change Gate', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: webcrypto,
    });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn(async () => undefined) },
    });
    authState.activeWorkspaceId = null;
    authState.serverEnabled = false;
    authState.user = null;
    authState.workspaces = [];
    vault.gates = [];
    vault.recovery.clear();
    loadEncryptedLocal.mockImplementation(async (key: string, fallback: unknown) => (
      key === 'fetchlab_authority_gates_v1'
        ? structuredClone(vault.gates)
        : structuredClone(vault.recovery.get(key) ?? fallback)
    ));
    saveEncryptedLocal.mockImplementation(async (key: string, value: unknown) => {
      if (key === 'fetchlab_authority_gates_v1') {
        vault.gates = structuredClone(value as LocalAuthorityGate[]);
      } else {
        vault.recovery.set(key, structuredClone(value));
      }
    });
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('runs the complete encrypted local policy path and labels simulations honestly', async () => {
    render(
      <AutonomyLab
        onClose={() => undefined}
        onOpenAdvanced={() => undefined}
        onOpenRequestBuilder={() => undefined}
      />,
    );

    expect(await screen.findByText('Create the first action gate')).toBeTruthy();
    const createButtons = screen.getAllByRole('button', { name: 'Create action gate' });
    fireEvent.click(createButtons[createButtons.length - 1]);
    fireEvent.change(screen.getByLabelText('Gate name'), { target: { value: 'Refund agent' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create gate' }));

    expect(await screen.findByText('Action rules')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Add first rule' }));
    fireEvent.click(screen.getByRole('button', { name: 'Enforce' }));
    fireEvent.change(screen.getByLabelText('Rule name'), { target: { value: 'Allow bounded refund' } });
    fireEvent.change(screen.getByLabelText('Decision'), { target: { value: 'allow' } });
    fireEvent.change(screen.getByLabelText('Tool pattern'), { target: { value: 'stripe.refunds.create' } });
    fireEvent.change(screen.getByLabelText('Operation'), { target: { value: 'write' } });
    fireEvent.change(screen.getByLabelText('Target pattern'), { target: { value: 'stripe://charges/*/refund' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));

    expect(await screen.findByText('Draft encrypted and saved on this device.')).toBeTruthy();
    expect(vault.gates[0].draftPolicy.rules[0].name).toBe('Allow bounded refund');

    fireEvent.click(screen.getByRole('button', { name: 'Connect' }));
    const actionInput = screen.getByLabelText('Action packet JSON');
    fireEvent.change(actionInput, { target: { value: '{' } });
    fireEvent.click(screen.getByRole('button', { name: 'Preview decision' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Action packet must be valid JSON.');

    fireEvent.change(actionInput, {
      target: {
        value: JSON.stringify({
          agent_id: 'refund-agent',
          session_id: 'run-1',
          tool: 'stripe.refunds.create',
          operation: 'write',
          target: 'stripe://charges/ch_123/refund',
          arguments: { amount: 75 },
          reversible: false,
        }),
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Preview decision' }));

    expect(await screen.findByText('Would execute')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByText('Local simulation')).toBeTruthy();
    expect(vault.gates[0].events).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Decisions' }));
    expect(await screen.findByText('Action decisions')).toBeTruthy();
    expect(screen.getByText('refund-agent')).toBeTruthy();
    expect(document.body.textContent).toContain('Local simulation');

    fireEvent.click(screen.getByRole('button', { name: 'Release' }));
    expect(await screen.findByText('Release review')).toBeTruthy();
    expect(screen.getByText('Local revision only')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Save local revision' }));
    expect(await screen.findByText('Local simulation revision 1 saved.')).toBeTruthy();
    expect(vault.gates[0].publishedRevision).toBe(1);
  });

  it('connects a workspace agent, reviews one action, approves expansion, and publishes', async () => {
    authState.activeWorkspaceId = 'workspace-1';
    authState.serverEnabled = true;
    authState.user = { id: 'user-1', email: 'owner@example.com', name: 'Owner', role: 'admin' };
    authState.workspaces = [{
      id: 'workspace-1',
      name: 'AI Platform',
      owner_id: 'user-1',
      member_role: 'admin',
    }];

    let remoteState = makeRemoteState();
    const credential: AuthorityCredential = {
      id: 'credential-1',
      user_id: 'user-1',
      workspace_id: 'workspace-1',
      name: 'Production agent',
      token_prefix: 'flk_prod',
      scopes: ['authority:check'],
      expires_at: null,
      revoked_at: null,
      last_used_at: null,
      created_at: '2026-09-01T12:00:00.000Z',
    };

    authFetch.mockImplementation(async (path: string, init?: RequestInit) => {
      const method = init?.method || 'GET';
      if (path.endsWith('/autonomy-studies') && method === 'GET') {
        return Response.json({ studies: [{ id: 'gate-1', name: 'Refund agent production' }] });
      }
      if (path.endsWith('/authority-tokens') && method === 'GET') {
        return Response.json({ credentials: [] });
      }
      if (path.endsWith('/authority-tokens') && method === 'POST') {
        return Response.json({ token: 'flk_prod_secret_once', credential });
      }
      if (path.endsWith('/authority') && method === 'GET') {
        return Response.json(structuredClone(remoteState));
      }
      if (path.includes('/authority/events/event-1/review') && method === 'POST') {
        remoteState = structuredClone(remoteState);
        remoteState.events[0].review_status = 'approved';
        remoteState.events[0].approval_expires_at = '2026-09-01T12:15:00.000Z';
        return Response.json({ event: remoteState.events[0] });
      }
      if (path.includes('/authority/expansions/event-1/review') && method === 'POST') {
        remoteState = structuredClone(remoteState);
        remoteState.diff.rows[0].review = {
          id: 'review-1',
          verdict: 'approved',
          reviewed_by: 'user-1',
          created_at: '2026-09-01T12:05:00.000Z',
        };
        remoteState.diff.unresolved_expansion_count = 0;
        return Response.json({ review: remoteState.diff.rows[0].review });
      }
      if (path.endsWith('/authority/publish') && method === 'POST') {
        remoteState = structuredClone(remoteState);
        remoteState.study.published_revision = 2;
        remoteState.published = {
          id: 'revision-2',
          revision: 2,
          fingerprint: 'draft-fingerprint',
          policy: structuredClone(draftPolicy),
          prior_fingerprint: 'published-fingerprint',
          published_by: 'user-1',
          created_at: '2026-09-01T12:10:00.000Z',
        };
        return Response.json({ revision: remoteState.published });
      }
      return Response.json({ error: `Unexpected request: ${method} ${path}` }, { status: 500 });
    });

    render(
      <AutonomyLab
        onClose={() => undefined}
        onOpenAdvanced={() => undefined}
        onOpenRequestBuilder={() => undefined}
      />,
    );

    expect(await screen.findByText('Connect an agent')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'New credential' }));
    fireEvent.change(screen.getByLabelText('Credential name'), { target: { value: 'Production agent' } });
    const credentialButtons = screen.getAllByRole('button', { name: 'Create credential' });
    fireEvent.click(credentialButtons[credentialButtons.length - 1]);
    expect(await screen.findByText('flk_prod_secret_once')).toBeTruthy();
    expect(screen.getByText('Credential created. Copy it now; FetchLab will not show it again.')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Decisions' }));
    expect(await screen.findByRole('button', { name: 'Approve once' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Approve once' }));
    expect(await screen.findByText('Action approved for one use.')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Release' }));
    const publishBeforeReview = await screen.findByRole('button', { name: 'Publish policy' });
    expect((publishBeforeReview as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Approve change' }));
    expect(await screen.findByText('Authority expansion approved.')).toBeTruthy();
    await waitFor(() => expect((screen.getByRole('button', { name: 'Publish policy' }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByRole('button', { name: 'Publish policy' }));
    expect(await screen.findByText('Policy revision 2 published.')).toBeTruthy();

    const calls = authFetch.mock.calls.map(([path, init]) => `${init?.method || 'GET'} ${path}`);
    expect(calls.some(call => call.includes('POST /api/workspaces/workspace-1/authority-tokens'))).toBe(true);
    expect(calls.some(call => call.startsWith('POST ') && call.includes('/authority/events/event-1/review'))).toBe(true);
    expect(calls.some(call => call.startsWith('POST ') && call.includes('/authority/expansions/event-1/review'))).toBe(true);
    expect(calls.some(call => call.startsWith('POST ') && call.endsWith('/authority/publish'))).toBe(true);
  });

  it('keeps workspace viewers read-only and hides credential administration', async () => {
    authState.activeWorkspaceId = 'workspace-1';
    authState.serverEnabled = true;
    authState.user = { id: 'viewer-1', email: 'viewer@example.com', name: 'Viewer', role: 'member' };
    authState.workspaces = [{
      id: 'workspace-1',
      name: 'AI Platform',
      owner_id: 'user-1',
      member_role: 'viewer',
    }];
    const remoteState = makeRemoteState();
    authFetch.mockImplementation(async (path: string) => {
      if (path.endsWith('/autonomy-studies')) {
        return Response.json({ studies: [{ id: 'gate-1', name: 'Refund agent production' }] });
      }
      if (path.endsWith('/authority')) return Response.json(structuredClone(remoteState));
      return Response.json({ error: `Unexpected request: ${path}` }, { status: 500 });
    });

    render(
      <AutonomyLab
        onClose={() => undefined}
        onOpenAdvanced={() => undefined}
        onOpenRequestBuilder={() => undefined}
      />,
    );

    expect(await screen.findByText('Connect an agent')).toBeTruthy();
    expect(screen.getByText('Credentials managed by admins')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'New credential' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Create action gate' })).toBeNull();
    expect(authFetch.mock.calls.some(([path]) => String(path).endsWith('/authority-tokens'))).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'Rules' }));
    expect(await screen.findByText('Viewer access')).toBeTruthy();
    expect((screen.getByLabelText('Rule name') as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Save draft' }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Release' }));
    expect((await screen.findByRole('button', { name: 'Publish policy' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole('button', { name: 'Approve change' })).toBeNull();
  });

  it('ignores a stale response after the operator switches action gates', async () => {
    authState.activeWorkspaceId = 'workspace-1';
    authState.serverEnabled = true;
    authState.user = { id: 'user-1', email: 'owner@example.com', name: 'Owner', role: 'admin' };
    authState.workspaces = [{
      id: 'workspace-1',
      name: 'AI Platform',
      owner_id: 'user-1',
      member_role: 'admin',
    }];

    const firstState = makeRemoteState();
    const secondState = makeRemoteState();
    secondState.study = {
      ...secondState.study,
      id: 'gate-2',
      name: 'Payments agent production',
      published_revision: 2,
    };
    secondState.published = {
      ...secondState.published!,
      id: 'revision-2',
      revision: 2,
      fingerprint: 'payments-fingerprint',
    };
    secondState.events = [];
    secondState.diff = {
      rows: [],
      expansion_count: 0,
      restriction_count: 0,
      unchanged_count: 0,
      unresolved_expansion_count: 0,
      evidence_complete: true,
      total_events: 0,
    };

    let resolveFirstState: ((response: Response) => void) | undefined;

    authFetch.mockImplementation(async (path: string) => {
      if (path.endsWith('/autonomy-studies')) {
        return Response.json({ studies: [
          { id: 'gate-1', name: 'Refund agent production' },
          { id: 'gate-2', name: 'Payments agent production' },
        ] });
      }
      if (path.endsWith('/authority-tokens')) return Response.json({ credentials: [] });
      if (path.includes('/autonomy-studies/gate-1/authority')) {
        return new Promise<Response>(resolve => {
          resolveFirstState = resolve;
        });
      }
      if (path.includes('/autonomy-studies/gate-2/authority')) {
        return Response.json(structuredClone(secondState));
      }
      return Response.json({ error: `Unexpected request: ${path}` }, { status: 500 });
    });

    render(
      <AutonomyLab
        onClose={() => undefined}
        onOpenAdvanced={() => undefined}
        onOpenRequestBuilder={() => undefined}
      />,
    );

    const selector = screen.getByLabelText('Active action gate') as HTMLSelectElement;
    await waitFor(() => expect(selector.options.length).toBe(2));
    await waitFor(() => expect(typeof resolveFirstState).toBe('function'));
    fireEvent.change(selector, { target: { value: 'gate-2' } });

    await waitFor(() => expect(screen.getAllByText('Revision 2').length).toBeGreaterThan(0));
    expect(selector.value).toBe('gate-2');

    await act(async () => {
      resolveFirstState?.(Response.json(structuredClone(firstState)));
      await Promise.resolve();
    });

    await waitFor(() => expect(screen.getAllByText('Revision 2').length).toBeGreaterThan(0));
    expect(selector.value).toBe('gate-2');
    expect(screen.queryAllByText('Revision 1')).toHaveLength(0);
  });

  it('shows a real loading state and preserves honesty when the workspace server fails', async () => {
    authState.activeWorkspaceId = 'workspace-1';
    authState.serverEnabled = true;
    authState.user = { id: 'user-1', email: 'owner@example.com', name: 'Owner', role: 'admin' };
    authState.workspaces = [{
      id: 'workspace-1',
      name: 'AI Platform',
      owner_id: 'user-1',
      member_role: 'admin',
    }];
    const rejectors: Array<(error: Error) => void> = [];
    authFetch.mockImplementation(() => new Promise<Response>((_resolve, reject) => {
      rejectors.push(reject);
    }));

    render(
      <AutonomyLab
        onClose={() => undefined}
        onOpenAdvanced={() => undefined}
        onOpenRequestBuilder={() => undefined}
      />,
    );

    expect(await screen.findByText('Loading action gates')).toBeTruthy();
    await act(async () => {
      rejectors.forEach(reject => reject(new Error('offline')));
      await Promise.resolve();
    });
    expect((await screen.findByRole('alert')).textContent).toContain('FetchLab server could not be reached');
    expect(screen.queryByText(/saved to the workspace/i)).toBeNull();
  });

  it('keeps advanced API tools available without confusing them with the gate', async () => {
    const onOpenAdvanced = vi.fn();
    render(
      <AutonomyLab
        onClose={() => undefined}
        onOpenAdvanced={onOpenAdvanced}
        onOpenRequestBuilder={() => undefined}
      />,
    );

    expect(await screen.findByText('Create the first action gate')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Advanced' }));
    expect(onOpenAdvanced).toHaveBeenCalledTimes(1);
  });
});
