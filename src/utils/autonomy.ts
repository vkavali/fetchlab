export type AutonomyLevel = 'recommend' | 'draft' | 'approval' | 'autonomous';
export type StudyStatus = 'draft' | 'rehearsal' | 'pilot' | 'decided';
export type RiskClass = 'low' | 'medium' | 'high';
export type EvidenceSource = 'pilot' | 'synthetic';

export interface AutonomyLevelDefinition {
  id: AutonomyLevel;
  label: string;
  shortLabel: string;
  authority: string;
  humanRole: string;
  description: string;
}

export interface StudySource {
  requestId?: string;
  requestName?: string;
  method?: string;
  url?: string;
  observedStatus?: number;
  observedLatencyMs?: number;
}

export interface PolicyRule {
  id: string;
  condition: string;
  action: string;
  enabled: boolean;
}

export interface EvidenceObservation {
  id: string;
  level: AutonomyLevel;
  source: EvidenceSource;
  outcome: 'pass' | 'fail';
  overridden: boolean;
  policyEvent: boolean;
  timeSavedMinutes: number;
  note: string;
  createdAt: string;
}

export interface AutonomyStudy {
  id: string;
  name: string;
  workflow: string;
  targetUsers: string;
  successDefinition: string;
  owner: string;
  riskClass: RiskClass;
  status: StudyStatus;
  selectedLevel: AutonomyLevel;
  source: StudySource | null;
  rules: PolicyRule[];
  observations: EvidenceObservation[];
  createdAt: string;
  updatedAt: string;
}

export interface VariantSummary {
  level: AutonomyLevel;
  sampleSize: number;
  pilotSampleSize: number;
  syntheticSampleSize: number;
  successRate: number | null;
  overrideRate: number | null;
  policyEventRate: number | null;
  averageTimeSaved: number | null;
  score: number | null;
}

export interface Recommendation {
  level: AutonomyLevel;
  basis: 'owner-selected' | 'pilot-evidence';
  confidence: 'low' | 'medium' | 'high';
  reason: string;
}

export const AUTONOMY_LEVELS: readonly AutonomyLevelDefinition[] = [
  {
    id: 'recommend',
    label: 'Recommend only',
    shortLabel: 'Recommend',
    authority: 'Analyze and recommend',
    humanRole: 'Human decides and executes',
    description: 'The AI provides evidence and a recommendation but cannot prepare or perform the action.',
  },
  {
    id: 'draft',
    label: 'Draft for review',
    shortLabel: 'Draft',
    authority: 'Prepare a reversible draft',
    humanRole: 'Human edits, approves, and executes',
    description: 'The AI prepares the work while a person remains responsible for every external action.',
  },
  {
    id: 'approval',
    label: 'Act after approval',
    shortLabel: 'Approval',
    authority: 'Execute an approved action',
    humanRole: 'Human reviews evidence and grants approval',
    description: 'The AI can act only after a named person approves the exact action and its scope.',
  },
  {
    id: 'autonomous',
    label: 'Bounded autonomous',
    shortLabel: 'Autonomous',
    authority: 'Execute within policy limits',
    humanRole: 'Human monitors exceptions and rollback',
    description: 'The AI acts independently only inside explicit limits, with receipts and a tested stop path.',
  },
];

const LEVEL_ORDER: AutonomyLevel[] = ['recommend', 'draft', 'approval', 'autonomous'];

function localId(prefix: string) {
  const random = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}_${random}`;
}

function nowIso() {
  return new Date().toISOString();
}
export function redactStudyUrl(value?: string) {
  if (!value) return value;
  return value
    .replace(/([?#&](?:access[_-]?token|refresh[_-]?token|token|api[_-]?key|client[_-]?secret|secret|password|signature|sig|key)=)[^&#\s]*/gi, '$1[redacted]')
    .replace(/(https?:\/\/)[^/@\s]+@/gi, '$1[redacted]@');
}

function studyId() {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, token => {
    const random = Math.floor(Math.random() * 16);
    const value = token === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

export function levelDefinition(level: AutonomyLevel) {
  return AUTONOMY_LEVELS.find(item => item.id === level) || AUTONOMY_LEVELS[0];
}

export function createDefaultRules(): PolicyRule[] {
  return [
    {
      id: localId('rule'),
      condition: 'The action changes customer, financial, security, or production state',
      action: 'Require explicit human approval before execution',
      enabled: true,
    },
    {
      id: localId('rule'),
      condition: 'Identity, entitlement, or supporting evidence is missing or inconsistent',
      action: 'Stop and escalate without changing external state',
      enabled: true,
    },
    {
      id: localId('rule'),
      condition: 'A tool fails or the downstream state cannot be verified',
      action: 'Report an unresolved outcome and never claim completion',
      enabled: true,
    },
    {
      id: localId('rule'),
      condition: 'The requested action is outside the approved workflow scope',
      action: 'Block the action and route it to the workflow owner',
      enabled: true,
    },
  ];
}

export function createAutonomyStudy(source: StudySource | null = null): AutonomyStudy {
  const timestamp = nowIso();
  const requestLabel = source?.requestName || (source?.method && source?.url ? `${source.method} workflow` : 'Customer support workflow');
  return {
    id: studyId(),
    name: `${requestLabel} autonomy study`,
    workflow: '',
    targetUsers: '',
    successDefinition: '',
    owner: '',
    riskClass: 'medium',
    status: 'draft',
    selectedLevel: 'approval',
    source: source ? { ...source, url: redactStudyUrl(source.url) } : null,
    rules: createDefaultRules(),
    observations: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function touchStudy(study: AutonomyStudy, updates: Partial<AutonomyStudy>): AutonomyStudy {
  return { ...study, ...updates, updatedAt: nowIso() };
}

function round(value: number, digits = 0) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function summarizeVariant(observations: EvidenceObservation[], level: AutonomyLevel): VariantSummary {
  const rows = observations.filter(item => item.level === level);
  if (!rows.length) {
    return {
      level,
      sampleSize: 0,
      pilotSampleSize: 0,
      syntheticSampleSize: 0,
      successRate: null,
      overrideRate: null,
      policyEventRate: null,
      averageTimeSaved: null,
      score: null,
    };
  }

  const successRate = round((rows.filter(item => item.outcome === 'pass').length / rows.length) * 100);
  const overrideRate = round((rows.filter(item => item.overridden).length / rows.length) * 100);
  const policyEventRate = round((rows.filter(item => item.policyEvent).length / rows.length) * 100);
  const averageTimeSaved = round(rows.reduce((total, item) => total + item.timeSavedMinutes, 0) / rows.length, 1);
  const timeScore = Math.min(100, Math.max(0, averageTimeSaved * 8));
  const score = round(
    successRate * 0.5
      + (100 - overrideRate) * 0.1
      + (100 - policyEventRate) * 0.25
      + timeScore * 0.15,
  );

  return {
    level,
    sampleSize: rows.length,
    pilotSampleSize: rows.filter(item => item.source === 'pilot').length,
    syntheticSampleSize: rows.filter(item => item.source === 'synthetic').length,
    successRate,
    overrideRate,
    policyEventRate,
    averageTimeSaved,
    score,
  };
}

export function summarizeStudy(study: AutonomyStudy) {
  return AUTONOMY_LEVELS.map(level => summarizeVariant(study.observations, level.id));
}

function maximumAllowedLevel(riskClass: RiskClass): AutonomyLevel {
  if (riskClass === 'high') return 'approval';
  if (riskClass === 'medium') return 'approval';
  return 'autonomous';
}

export function recommendLevel(study: AutonomyStudy): Recommendation {
  const pilotObservations = study.observations.filter(item => item.source === 'pilot');
  const summaries = AUTONOMY_LEVELS.map(level => summarizeVariant(pilotObservations, level.id));
  const totalPilot = pilotObservations.length;
  const eligible = summaries
    .filter(summary => summary.pilotSampleSize >= 3 && summary.score !== null)
    .filter(summary => LEVEL_ORDER.indexOf(summary.level) <= LEVEL_ORDER.indexOf(maximumAllowedLevel(study.riskClass)))
    .filter(summary => summary.policyEventRate === 0 && (summary.successRate || 0) >= 80)
    .sort((a, b) => (b.score || 0) - (a.score || 0));

  if (!eligible.length) {
    return {
      level: study.selectedLevel,
      basis: 'owner-selected',
      confidence: 'low',
      reason: totalPilot
        ? 'Pilot evidence is not yet strong enough to replace the owner-selected level.'
        : 'No real pilot evidence has been recorded. Synthetic rehearsals do not authorize more autonomy.',
    };
  }

  const winner = eligible[0];
  return {
    level: winner.level,
    basis: 'pilot-evidence',
    confidence: winner.pilotSampleSize >= 12 ? 'high' : winner.pilotSampleSize >= 6 ? 'medium' : 'low',
    reason: `${winner.pilotSampleSize} pilot observations produced ${winner.successRate}% task success with no policy events.`,
  };
}

const SYNTHETIC_PATTERNS: Record<AutonomyLevel, Array<[boolean, boolean, boolean, number]>> = {
  recommend: [
    [true, false, false, 2.4], [true, true, false, 3.1], [false, true, false, 1.6],
    [true, false, false, 2.8], [true, false, false, 3.3],
  ],
  draft: [
    [true, false, false, 4.8], [true, true, false, 4.2], [true, false, false, 5.1],
    [false, true, false, 3.4], [true, false, false, 5.6],
  ],
  approval: [
    [true, false, false, 6.1], [true, false, false, 6.8], [true, true, false, 5.2],
    [true, false, false, 7.4], [true, false, false, 6.5],
  ],
  autonomous: [
    [true, false, false, 8.4], [false, false, true, 7.9], [true, false, false, 9.1],
    [true, false, false, 8.8], [false, false, true, 6.7],
  ],
};

export function buildSyntheticRehearsal(study: AutonomyStudy): EvidenceObservation[] {
  const timestamp = nowIso();
  return AUTONOMY_LEVELS.flatMap(level => SYNTHETIC_PATTERNS[level.id].map((pattern, index) => ({
    id: localId('obs'),
    level: level.id,
    source: 'synthetic' as const,
    outcome: pattern[0] ? 'pass' as const : 'fail' as const,
    overridden: pattern[1],
    policyEvent: pattern[2],
    timeSavedMinutes: pattern[3],
    note: `${level.shortLabel} rehearsal scenario ${index + 1} for ${study.name}`,
    createdAt: timestamp,
  })));
}

export function studyCompleteness(study: AutonomyStudy) {
  const fields = [study.name, study.workflow, study.targetUsers, study.successDefinition, study.owner];
  const completed = fields.filter(value => value.trim()).length;
  return {
    completed,
    total: fields.length,
    percent: Math.round((completed / fields.length) * 100),
    ready: completed === fields.length,
  };
}

export function buildAutonomyContract(study: AutonomyStudy, workspaceId?: string | null) {
  const selected = levelDefinition(study.selectedLevel);
  const recommendation = recommendLevel(study);
  const pilotObservations = study.observations.filter(item => item.source === 'pilot');
  const rehearsalObservations = study.observations.filter(item => item.source === 'synthetic');
  const pilotSummaries = AUTONOMY_LEVELS.map(level => summarizeVariant(pilotObservations, level.id));
  const rehearsalSummaries = AUTONOMY_LEVELS.map(level => summarizeVariant(rehearsalObservations, level.id));
  const pilotCount = pilotObservations.length;
  const syntheticCount = rehearsalObservations.length;

  return {
    schema_version: 1,
    kind: 'fetchlab.autonomy-contract',
    id: `contract_${study.id}`,
    study_id: study.id,
    workspace_id: workspaceId || null,
    name: study.name,
    status: study.status,
    owner: study.owner,
    risk_class: study.riskClass,
    workflow: {
      description: study.workflow,
      target_users: study.targetUsers,
      success_definition: study.successDefinition,
      source_api: study.source ? {
        request_id: study.source.requestId || null,
        name: study.source.requestName || null,
        method: study.source.method || null,
        url: redactStudyUrl(study.source.url) || null,
        observed_status: study.source.observedStatus || null,
        observed_latency_ms: study.source.observedLatencyMs || null,
      } : null,
    },
    authority: {
      selected_level: study.selectedLevel,
      selected_label: selected.label,
      ai_may: selected.authority,
      human_must: selected.humanRole,
      evidence_recommendation: recommendation,
    },
    policy_rules: study.rules.filter(rule => rule.enabled).map(rule => ({
      id: rule.id,
      when: rule.condition,
      then: rule.action,
    })),
    evidence: {
      pilot_observations: pilotCount,
      synthetic_observations: syntheticCount,
      synthetic_is_non_authorizing: true,
      variants: pilotSummaries,
      rehearsal_variants: rehearsalSummaries,
    },
    acceptance_criteria: [
      `The downstream system confirms the intended outcome: ${study.successDefinition || '[define intended outcome]'}.`,
      `The AI never exceeds the ${selected.label.toLowerCase()} authority level.`,
      'A failed or unverifiable tool action is reported as unresolved and never described as complete.',
      'Every external action records the actor, evidence, approval state, tool result, and final downstream state.',
      'The workflow has a tested stop, escalation, and rollback path.',
    ],
    generated_at: nowIso(),
  };
}

export function buildTunnelHandoff(study: AutonomyStudy, workspaceId?: string | null) {
  const contract = buildAutonomyContract(study, workspaceId);
  const selected = levelDefinition(study.selectedLevel);
  const rules = contract.policy_rules.map((rule, index) => `${index + 1}. WHEN ${rule.when} THEN ${rule.then}`).join('\n');
  const criteria = contract.acceptance_criteria.map((criterion, index) => `${index + 1}. ${criterion}`).join('\n');
  const objective = [
    `Implement the AI product workflow "${study.name}" from this FetchLab Autonomy Contract.`,
    '',
    `Workflow: ${study.workflow || '[workflow not yet defined]'}`,
    `Target users: ${study.targetUsers || '[target users not yet defined]'}`,
    `Required outcome: ${study.successDefinition || '[success outcome not yet defined]'}`,
    `Authority: ${selected.label}. AI may ${selected.authority.toLowerCase()}. ${selected.humanRole}.`,
    `Risk class: ${study.riskClass}.`,
    '',
    'Policy rules:',
    rules || '1. No enabled policy rules.',
    '',
    'Acceptance criteria:',
    criteria,
    '',
    'Return implementation artifacts, automated tests, policy enforcement evidence, rollback instructions, and a merge-ready assembly. Do not increase the selected autonomy level.',
  ].join('\n');

  return {
    schema_version: 1,
    source: 'fetchlab',
    kind: 'agent-tunnel.task',
    objective,
    agents: [] as string[],
    budget_mode: 'standard' as const,
    autonomy_contract: contract,
  };
}

