import {
  buildAuthorityDiff,
  canonicalize,
  evaluatePolicy,
  validateAction,
  validatePolicy,
  type AuthorityAction,
  type AuthorityConstraint,
  type AuthorityDecision,
  type AuthorityPolicy,
  type AuthorityRule,
  type ValidationError,
} from '../../shared/authorityEngine.js';

export type {
  AuthorityAction,
  AuthorityConstraint,
  AuthorityDecision,
  AuthorityPolicy,
  AuthorityRule,
  ValidationError,
};

export interface AuthorityEvent {
  event_id: string;
  study_id: string;
  agent_id?: string;
  session_id?: string | null;
  action?: AuthorityAction;
  action_hash: string;
  decision: AuthorityDecision;
  execute: boolean;
  mode: AuthorityPolicy['mode'];
  reason: string;
  matched_rule_id: string | null;
  policy_revision: number;
  policy_fingerprint: string;
  review_status: 'pending' | 'approved' | 'denied' | 'not_required' | 'shadow';
  approval_expires_at: string | null;
  consumed_at: string | null;
  created_at: string;
  reused?: boolean;
  source?: 'runtime' | 'local_simulation';
}

export interface AuthorityDiffRow {
  eventId: string;
  actionHash: string | null;
  previousDecision: AuthorityDecision;
  nextDecision: AuthorityDecision;
  previousRuleId: string | null;
  nextRuleId: string | null;
  change: 'expansion' | 'restriction' | 'unchanged';
  review: null | {
    id: string;
    verdict: 'approved' | 'rejected';
    note?: string | null;
    reviewed_by: string;
    created_at: string;
  };
}

export interface AuthorityRevision {
  id: string;
  revision: number;
  fingerprint: string;
  policy: AuthorityPolicy;
  prior_fingerprint: string | null;
  published_by: string | null;
  created_at: string;
}

export interface AuthorityState {
  study: {
    id: string;
    name: string;
    draft_policy: AuthorityPolicy;
    published_revision: number;
    updated_at: string;
  };
  draft_fingerprint: string;
  published: AuthorityRevision | null;
  events: AuthorityEvent[];
  diff: {
    rows: AuthorityDiffRow[];
    expansion_count: number;
    restriction_count: number;
    unchanged_count: number;
    unresolved_expansion_count: number;
    evidence_complete: boolean;
    total_events: number;
  };
}

export interface AuthorityCredential {
  id: string;
  user_id: string;
  workspace_id: string;
  name: string;
  token_prefix: string;
  scopes: string[];
  expires_at: string | null;
  revoked_at: string | null;
  last_used_at: string | null;
  created_at: string;
}

export interface LocalAuthorityGate {
  id: string;
  name: string;
  draftPolicy: AuthorityPolicy;
  publishedPolicy: AuthorityPolicy | null;
  publishedRevision: number;
  events: AuthorityEvent[];
  createdAt: string;
  updatedAt: string;
}

export function emptyAuthorityPolicy(): AuthorityPolicy {
  return { version: 1, mode: 'shadow', defaultDecision: 'deny', rules: [] };
}

export function createAuthorityRule(): AuthorityRule {
  return {
    id: `rule_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    name: 'New action rule',
    enabled: true,
    effect: 'require_approval',
    toolPattern: '*',
    operation: '*',
    targetPattern: '*',
    constraints: [],
  };
}

export function createLocalGate(name: string): LocalAuthorityGate {
  const now = new Date().toISOString();
  return {
    id: `gate_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    name,
    draftPolicy: emptyAuthorityPolicy(),
    publishedPolicy: null,
    publishedRevision: 0,
    events: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function localAuthorityDiff(gate: LocalAuthorityGate) {
  return buildAuthorityDiff(
    gate.events.filter(event => event.action).map(event => ({
      id: event.event_id,
      action_hash: event.action_hash,
      action: event.action as AuthorityAction,
    })),
    gate.publishedPolicy,
    gate.draftPolicy,
  );
}

export { canonicalize, evaluatePolicy, validateAction, validatePolicy };
