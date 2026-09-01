const EFFECT_PRIORITY = Object.freeze({
  deny: 3,
  require_approval: 2,
  allow: 1,
});

const DECISION_AUTHORITY = Object.freeze({
  deny: 0,
  require_approval: 1,
  allow: 2,
});

const OPERATIONS = new Set(['read', 'write', 'delete', 'execute', 'unknown']);
const EFFECTS = new Set(Object.keys(EFFECT_PRIORITY));
const CONSTRAINT_OPERATORS = new Set([
  'eq', 'neq', 'lt', 'lte', 'gt', 'gte', 'in', 'contains', 'exists',
]);
const BLOCKED_PATH_SEGMENTS = new Set(['__proto__', 'prototype', 'constructor']);
const SENSITIVE_PATH_SEGMENT = /^(password|secret|token|api[_-]?key|client[_-]?secret|access[_-]?token|refresh[_-]?token|authorization|cookie|credential|private[_-]?key)$/i;

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function canonicalize(value) {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalize(item === undefined ? null : item)).join(',')}]`;
  }
  const entries = Object.keys(value)
    .filter((key) => value[key] !== undefined)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`);
  return `{${entries.join(',')}}`;
}

function addError(errors, path, message) {
  errors.push({ path, message });
}

function validPattern(value) {
  return typeof value === 'string' && value.length > 0 && value.length <= 500;
}

export function validatePolicy(policy, { requireEnabledRule = false } = {}) {
  const errors = [];
  if (!isRecord(policy)) {
    return { valid: false, errors: [{ path: 'policy', message: 'Policy must be an object.' }] };
  }

  if (policy.version !== 1) addError(errors, 'version', 'Version must be 1.');
  if (!['shadow', 'enforce'].includes(policy.mode)) {
    addError(errors, 'mode', 'Mode must be shadow or enforce.');
  }
  if (policy.defaultDecision !== 'deny') {
    addError(errors, 'defaultDecision', 'Unknown actions must default to deny.');
  }
  if (!Array.isArray(policy.rules)) {
    addError(errors, 'rules', 'Rules must be an array.');
    return { valid: false, errors };
  }
  if (policy.rules.length > 250) addError(errors, 'rules', 'A policy can contain at most 250 rules.');

  const ids = new Set();
  let enabledCount = 0;
  policy.rules.forEach((rule, index) => {
    const base = `rules.${index}`;
    if (!isRecord(rule)) {
      addError(errors, base, 'Rule must be an object.');
      return;
    }
    if (typeof rule.id !== 'string' || !rule.id.trim() || rule.id.length > 100) {
      addError(errors, `${base}.id`, 'Rule id is required and must be at most 100 characters.');
    } else if (ids.has(rule.id)) {
      addError(errors, `${base}.id`, 'Rule ids must be unique.');
    } else {
      ids.add(rule.id);
    }
    if (typeof rule.name !== 'string' || !rule.name.trim() || rule.name.length > 120) {
      addError(errors, `${base}.name`, 'Rule name is required and must be at most 120 characters.');
    }
    if (typeof rule.enabled !== 'boolean') addError(errors, `${base}.enabled`, 'Enabled must be true or false.');
    if (rule.enabled === true) enabledCount += 1;
    if (!EFFECTS.has(rule.effect)) addError(errors, `${base}.effect`, 'Effect is invalid.');
    if (!validPattern(rule.toolPattern)) addError(errors, `${base}.toolPattern`, 'Tool pattern is required and must be at most 500 characters.');
    if (rule.operation !== '*' && !OPERATIONS.has(rule.operation)) {
      addError(errors, `${base}.operation`, 'Operation is invalid.');
    }
    if (!validPattern(rule.targetPattern)) addError(errors, `${base}.targetPattern`, 'Target pattern is required and must be at most 500 characters.');

    if (!Array.isArray(rule.constraints)) {
      addError(errors, `${base}.constraints`, 'Constraints must be an array.');
      return;
    }
    if (rule.constraints.length > 25) addError(errors, `${base}.constraints`, 'A rule can contain at most 25 constraints.');
    rule.constraints.forEach((constraint, constraintIndex) => {
      const cbase = `${base}.constraints.${constraintIndex}`;
      if (!isRecord(constraint)) {
        addError(errors, cbase, 'Constraint must be an object.');
        return;
      }
      if (typeof constraint.path !== 'string' || !constraint.path.trim() || constraint.path.length > 200) {
        addError(errors, `${cbase}.path`, 'Constraint path is required and must be at most 200 characters.');
      } else {
        const segments = constraint.path.split('.');
        if (segments.some((segment) => BLOCKED_PATH_SEGMENTS.has(segment))) {
          addError(errors, `${cbase}.path`, 'Constraint path contains a blocked segment.');
        } else if (segments.some((segment) => SENSITIVE_PATH_SEGMENT.test(segment))) {
          addError(errors, `${cbase}.path`, 'Credentials and secrets cannot be policy constraint values.');
        }
      }
      if (!CONSTRAINT_OPERATORS.has(constraint.operator)) {
        addError(errors, `${cbase}.operator`, 'Constraint operator is invalid.');
      }
      if (constraint.operator === 'in' && !Array.isArray(constraint.value)) {
        addError(errors, `${cbase}.value`, 'The in operator requires an array value.');
      }
      if (constraint.operator === 'exists' && typeof constraint.value !== 'boolean') {
        addError(errors, `${cbase}.value`, 'The exists operator requires a boolean value.');
      }
    });
  });

  if (requireEnabledRule && enabledCount === 0) {
    addError(errors, 'rules', 'At least one enabled rule is required to publish.');
  }
  return { valid: errors.length === 0, errors };
}

export function validateAction(action) {
  const errors = [];
  if (!isRecord(action)) {
    return { valid: false, errors: [{ path: 'action', message: 'Action must be an object.' }] };
  }
  if (typeof action.agent_id !== 'string' || !action.agent_id.trim() || action.agent_id.length > 200) {
    addError(errors, 'agent_id', 'Agent id is required and must be at most 200 characters.');
  }
  if (action.session_id !== undefined && (typeof action.session_id !== 'string' || action.session_id.length > 200)) {
    addError(errors, 'session_id', 'Session id must be a string of at most 200 characters.');
  }
  if (typeof action.tool !== 'string' || !action.tool.trim() || action.tool.length > 300) {
    addError(errors, 'tool', 'Tool is required and must be at most 300 characters.');
  }
  if (!OPERATIONS.has(action.operation)) addError(errors, 'operation', 'Operation is invalid.');
  if (typeof action.target !== 'string' || !action.target.trim() || action.target.length > 2000) {
    addError(errors, 'target', 'Target is required and must be at most 2000 characters.');
  }
  if (action.arguments !== undefined && !isRecord(action.arguments)) {
    addError(errors, 'arguments', 'Arguments must be an object.');
  }
  if (action.reversible !== undefined && typeof action.reversible !== 'boolean') {
    addError(errors, 'reversible', 'Reversible must be true or false.');
  }
  if (action.occurred_at !== undefined && (typeof action.occurred_at !== 'string' || Number.isNaN(Date.parse(action.occurred_at)))) {
    addError(errors, 'occurred_at', 'Occurred at must be an ISO date string.');
  }
  return { valid: errors.length === 0, errors };
}

function wildcardMatch(pattern, value) {
  let patternIndex = 0;
  let valueIndex = 0;
  let starIndex = -1;
  let starValueIndex = -1;

  while (valueIndex < value.length) {
    if (patternIndex < pattern.length && pattern[patternIndex] === value[valueIndex]) {
      patternIndex += 1;
      valueIndex += 1;
    } else if (patternIndex < pattern.length && pattern[patternIndex] === '*') {
      starIndex = patternIndex;
      starValueIndex = valueIndex;
      patternIndex += 1;
    } else if (starIndex !== -1) {
      patternIndex = starIndex + 1;
      starValueIndex += 1;
      valueIndex = starValueIndex;
    } else {
      return false;
    }
  }

  while (patternIndex < pattern.length && pattern[patternIndex] === '*') patternIndex += 1;
  return patternIndex === pattern.length;
}

function getPath(root, path) {
  let current = root;
  for (const segment of path.split('.')) {
    if (!segment || BLOCKED_PATH_SEGMENTS.has(segment) || !isRecord(current) || !Object.prototype.hasOwnProperty.call(current, segment)) {
      return { exists: false, value: undefined };
    }
    current = current[segment];
  }
  return { exists: true, value: current };
}

function equal(left, right) {
  return canonicalize(left) === canonicalize(right);
}

function constraintMatches(argumentsObject, constraint) {
  const actual = getPath(argumentsObject, constraint.path);
  switch (constraint.operator) {
    case 'exists': return actual.exists === constraint.value;
    case 'eq': return actual.exists && equal(actual.value, constraint.value);
    case 'neq': return !actual.exists || !equal(actual.value, constraint.value);
    case 'lt': return actual.exists && typeof actual.value === 'number' && typeof constraint.value === 'number' && actual.value < constraint.value;
    case 'lte': return actual.exists && typeof actual.value === 'number' && typeof constraint.value === 'number' && actual.value <= constraint.value;
    case 'gt': return actual.exists && typeof actual.value === 'number' && typeof constraint.value === 'number' && actual.value > constraint.value;
    case 'gte': return actual.exists && typeof actual.value === 'number' && typeof constraint.value === 'number' && actual.value >= constraint.value;
    case 'in': return actual.exists && constraint.value.some((candidate) => equal(actual.value, candidate));
    case 'contains':
      if (!actual.exists) return false;
      if (typeof actual.value === 'string' && typeof constraint.value === 'string') return actual.value.includes(constraint.value);
      if (Array.isArray(actual.value)) return actual.value.some((candidate) => equal(candidate, constraint.value));
      return false;
    default: return false;
  }
}

function ruleMatches(rule, action) {
  if (!rule.enabled) return false;
  if (!wildcardMatch(rule.toolPattern, action.tool)) return false;
  if (rule.operation !== '*' && rule.operation !== action.operation) return false;
  if (!wildcardMatch(rule.targetPattern, action.target)) return false;
  return rule.constraints.every((constraint) => constraintMatches(action.arguments || {}, constraint));
}

export function evaluatePolicy(policy, action) {
  const policyValidation = validatePolicy(policy);
  if (!policyValidation.valid) {
    return { decision: 'deny', matchedRuleId: null, reason: 'Policy is invalid.', errors: policyValidation.errors };
  }
  const actionValidation = validateAction(action);
  if (!actionValidation.valid) {
    return { decision: 'deny', matchedRuleId: null, reason: 'Action is invalid.', errors: actionValidation.errors };
  }

  const matching = policy.rules.filter((rule) => ruleMatches(rule, action));
  if (!matching.length) {
    return { decision: 'deny', matchedRuleId: null, reason: 'No published rule matched this action.' };
  }
  const selected = matching.reduce((current, rule) => (
    EFFECT_PRIORITY[rule.effect] > EFFECT_PRIORITY[current.effect] ? rule : current
  ));
  return {
    decision: selected.effect,
    matchedRuleId: selected.id,
    reason: `Matched ${selected.name}.`,
    matchedRuleIds: matching.map((rule) => rule.id),
  };
}

export function classifyDecisionChange(previousDecision, nextDecision) {
  const previous = DECISION_AUTHORITY[previousDecision] ?? 0;
  const next = DECISION_AUTHORITY[nextDecision] ?? 0;
  if (next > previous) return 'expansion';
  if (next < previous) return 'restriction';
  return 'unchanged';
}

export function buildAuthorityDiff(events, publishedPolicy, draftPolicy) {
  const rows = events.map((event) => {
    const previous = publishedPolicy
      ? evaluatePolicy(publishedPolicy, event.action)
      : { decision: 'deny', matchedRuleId: null, reason: 'No published policy.' };
    const next = evaluatePolicy(draftPolicy, event.action);
    return {
      eventId: event.id,
      actionHash: event.action_hash || null,
      previousDecision: previous.decision,
      nextDecision: next.decision,
      previousRuleId: previous.matchedRuleId,
      nextRuleId: next.matchedRuleId,
      change: classifyDecisionChange(previous.decision, next.decision),
    };
  });
  return {
    rows,
    expansions: rows.filter((row) => row.change === 'expansion'),
    restrictions: rows.filter((row) => row.change === 'restriction'),
    unchanged: rows.filter((row) => row.change === 'unchanged'),
  };
}

export const AUTHORITY_DEFAULT_POLICY = Object.freeze({
  version: 1,
  mode: 'shadow',
  defaultDecision: 'deny',
  rules: [],
});
