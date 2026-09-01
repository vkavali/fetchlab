export type AuthorityDecision = 'allow' | 'require_approval' | 'deny';

export interface AuthorityAction {
  agent_id: string;
  session_id?: string;
  tool: string;
  operation: 'read' | 'write' | 'delete' | 'execute' | 'unknown';
  target: string;
  arguments?: Record<string, unknown>;
  reversible?: boolean;
  occurred_at?: string;
}

export interface AuthorityConstraint {
  path: string;
  operator: 'eq' | 'neq' | 'lt' | 'lte' | 'gt' | 'gte' | 'in' | 'contains' | 'exists';
  value: unknown;
}

export interface AuthorityRule {
  id: string;
  name: string;
  enabled: boolean;
  effect: AuthorityDecision;
  toolPattern: string;
  operation: AuthorityAction['operation'] | '*';
  targetPattern: string;
  constraints: AuthorityConstraint[];
}

export interface AuthorityPolicy {
  version: 1;
  mode: 'shadow' | 'enforce';
  defaultDecision: 'deny';
  rules: AuthorityRule[];
}

export interface ValidationError {
  path: string;
  message: string;
}

export function canonicalize(value: unknown): string;
export function validatePolicy(policy: unknown, options?: { requireEnabledRule?: boolean }): { valid: boolean; errors: ValidationError[] };
export function validateAction(action: unknown): { valid: boolean; errors: ValidationError[] };
export function evaluatePolicy(policy: AuthorityPolicy, action: AuthorityAction): {
  decision: AuthorityDecision;
  matchedRuleId: string | null;
  matchedRuleIds?: string[];
  reason: string;
  errors?: ValidationError[];
};
export function classifyDecisionChange(previousDecision: AuthorityDecision, nextDecision: AuthorityDecision): 'expansion' | 'restriction' | 'unchanged';
export function buildAuthorityDiff(
  events: Array<{ id: string; action_hash?: string; action: AuthorityAction }>,
  publishedPolicy: AuthorityPolicy | null,
  draftPolicy: AuthorityPolicy,
): {
  rows: Array<{
    eventId: string;
    actionHash: string | null;
    previousDecision: AuthorityDecision;
    nextDecision: AuthorityDecision;
    previousRuleId: string | null;
    nextRuleId: string | null;
    change: 'expansion' | 'restriction' | 'unchanged';
  }>;
  expansions: unknown[];
  restrictions: unknown[];
  unchanged: unknown[];
};
export const AUTHORITY_DEFAULT_POLICY: Readonly<AuthorityPolicy>;
