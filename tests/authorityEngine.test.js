import { describe, expect, it } from 'vitest';
import {
  buildAuthorityDiff,
  canonicalize,
  evaluatePolicy,
  validateAction,
  validatePolicy,
} from '../shared/authorityEngine.js';

const action = {
  agent_id: 'refund-agent',
  session_id: 'session-1',
  tool: 'stripe.refunds.create',
  operation: 'write',
  target: 'stripe://charges/ch_123/refund',
  arguments: { amount: 75, currency: 'usd', metadata: { reason: 'duplicate' } },
  reversible: false,
};

function policy(rules, mode = 'enforce') {
  return { version: 1, mode, defaultDecision: 'deny', rules };
}

function rule(overrides = {}) {
  return {
    id: 'refund-under-100',
    name: 'Refund under $100',
    enabled: true,
    effect: 'allow',
    toolPattern: 'stripe.refunds.*',
    operation: 'write',
    targetPattern: 'stripe://charges/*/refund',
    constraints: [{ path: 'amount', operator: 'lte', value: 100 }],
    ...overrides,
  };
}

describe('authority policy engine', () => {
  it('evaluates wildcard rules and typed argument constraints', () => {
    expect(evaluatePolicy(policy([rule()]), action)).toMatchObject({
      decision: 'allow',
      matchedRuleId: 'refund-under-100',
    });
    expect(evaluatePolicy(policy([rule()]), {
      ...action,
      arguments: { ...action.arguments, amount: 101 },
    })).toMatchObject({ decision: 'deny', matchedRuleId: null });
  });

  it('uses deny over approval and approval over allow regardless of rule order', () => {
    const rules = [
      rule(),
      rule({ id: 'approve', name: 'Review all refunds', effect: 'require_approval', constraints: [] }),
      rule({ id: 'deny', name: 'Block irreversible calls', effect: 'deny', constraints: [{ path: 'currency', operator: 'eq', value: 'usd' }] }),
    ];
    expect(evaluatePolicy(policy(rules), action)).toMatchObject({ decision: 'deny', matchedRuleId: 'deny' });

    rules[2].enabled = false;
    expect(evaluatePolicy(policy(rules), action)).toMatchObject({ decision: 'require_approval', matchedRuleId: 'approve' });
  });

  it('fails closed for unknown actions and invalid policy input', () => {
    expect(evaluatePolicy(policy([rule()]), { ...action, tool: 'github.repos.delete' })).toMatchObject({
      decision: 'deny',
      reason: 'No published rule matched this action.',
    });
    expect(validatePolicy({ version: 1, mode: 'enforce', defaultDecision: 'allow', rules: [] }).valid).toBe(false);
    expect(validateAction({ ...action, arguments: [] }).valid).toBe(false);
  });

  it('treats non-wildcard pattern characters literally and handles dense globs safely', () => {
    const literalRule = rule({
      toolPattern: 'billing.invoice[0].create',
      targetPattern: 'billing://invoice/(primary)',
      constraints: [],
    });
    const literalAction = {
      ...action,
      tool: 'billing.invoice[0].create',
      target: 'billing://invoice/(primary)',
    };
    expect(evaluatePolicy(policy([literalRule]), literalAction).decision).toBe('allow');
    expect(evaluatePolicy(policy([literalRule]), { ...literalAction, tool: 'billing.invoice0.create' }).decision).toBe('deny');

    const denseGlob = '*a*a*a*a*a*a*a*a*a*a*z';
    expect(evaluatePolicy(policy([rule({ toolPattern: denseGlob, constraints: [] })]), {
      ...action,
      tool: `${'a'.repeat(250)}z`,
    }).decision).toBe('allow');
  });

  it('rejects policy constraints that would persist credential values', () => {
    const secretPolicy = policy([rule({
      constraints: [{ path: 'auth.api_key', operator: 'eq', value: 'sk-live-secret' }],
    })]);
    const result = validatePolicy(secretPolicy);
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.message.includes('Credentials and secrets'))).toBe(true);

    expect(validatePolicy(policy([rule({
      constraints: [{ path: 'credential_type', operator: 'eq', value: 'service' }],
    })])).valid).toBe(true);
  });

  it('canonicalizes object keys so hashes can bind to the exact semantic payload', () => {
    expect(canonicalize({ b: 2, a: { d: 4, c: 3 } })).toBe(canonicalize({ a: { c: 3, d: 4 }, b: 2 }));
    expect(canonicalize({ amount: 75 })).not.toBe(canonicalize({ amount: 76 }));
  });

  it('exposes authority expansions and restrictions from real evidence', () => {
    const events = [{ id: 'event-1', action }, { id: 'event-2', action: { ...action, tool: 'github.issues.get', operation: 'read', target: 'github://issues/1' } }];
    const published = policy([
      rule({ effect: 'require_approval' }),
      rule({ id: 'github-read', name: 'Read issue', toolPattern: 'github.issues.get', operation: 'read', targetPattern: 'github://issues/*', constraints: [] }),
    ]);
    const draft = policy([
      rule({ effect: 'allow' }),
      rule({ id: 'github-read', name: 'Read issue', effect: 'deny', toolPattern: 'github.issues.get', operation: 'read', targetPattern: 'github://issues/*', constraints: [] }),
    ]);

    const diff = buildAuthorityDiff(events, published, draft);
    expect(diff.expansions.map((row) => row.eventId)).toEqual(['event-1']);
    expect(diff.restrictions.map((row) => row.eventId)).toEqual(['event-2']);
  });
});
