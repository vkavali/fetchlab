import { describe, expect, it } from 'vitest';
import {
  AUTONOMY_LEVELS,
  buildAutonomyContract,
  buildSyntheticRehearsal,
  buildTunnelHandoff,
  createAutonomyStudy,
  recommendLevel,
  redactStudyUrl,
  studyCompleteness,
  summarizeStudy,
  type AutonomyLevel,
  type AutonomyStudy,
  type EvidenceObservation,
} from '../src/utils/autonomy';

function pilot(level: AutonomyLevel, index: number, overrides: Partial<EvidenceObservation> = {}): EvidenceObservation {
  return {
    id: 'pilot-' + index,
    level,
    source: 'pilot',
    outcome: 'pass',
    overridden: false,
    policyEvent: false,
    timeSavedMinutes: 6,
    note: 'Observed in real workflow',
    createdAt: new Date(2026, 0, index + 1).toISOString(),
    ...overrides,
  };
}

function completeStudy(): AutonomyStudy {
  return {
    ...createAutonomyStudy({
      requestId: 'request-1',
      requestName: 'Refund order',
      method: 'POST',
      url: 'https://api.example.com/refunds',
      observedStatus: 200,
      observedLatencyMs: 184,
    }),
    name: 'Refund exception study',
    workflow: 'Review a refund exception and update the billing system.',
    targetUsers: 'Support leads',
    successDefinition: 'The approved refund is visible in the billing ledger.',
    owner: 'Revenue operations',
  };
}

describe('autonomy study model', () => {
  it('creates a PostgreSQL-compatible study with safe default authority and policy rules', () => {
    const study = createAutonomyStudy(null);

    expect(study.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(study.selectedLevel).toBe('approval');
    expect(study.riskClass).toBe('medium');
    expect(study.rules).toHaveLength(4);
    expect(study.observations).toEqual([]);
  });

  it('redacts credentials from attached API URLs', () => {
    expect(redactStudyUrl('https://user:pass@api.example.com/run?api_key=secret&safe=1#access_token=token')).toBe(
      'https://[redacted]@api.example.com/run?api_key=[redacted]&safe=1#access_token=[redacted]',
    );
    const study = createAutonomyStudy({ url: 'https://api.example.com/run?token=secret' });
    expect(study.source?.url).toBe('https://api.example.com/run?token=[redacted]');
  });
  it('keeps synthetic rehearsal evidence non-authorizing', () => {
    const study = completeStudy();
    study.observations = buildSyntheticRehearsal(study);

    expect(study.observations).toHaveLength(20);
    expect(study.observations.every(item => item.source === 'synthetic')).toBe(true);
    expect(summarizeStudy(study).every(summary => summary.syntheticSampleSize === 5)).toBe(true);
    expect(recommendLevel(study)).toMatchObject({
      level: 'approval',
      basis: 'owner-selected',
      confidence: 'low',
    });
  });

  it('uses qualifying real pilot evidence while respecting the risk ceiling', () => {
    const lowRisk = completeStudy();
    lowRisk.riskClass = 'low';
    lowRisk.observations = [
      ...buildSyntheticRehearsal(lowRisk),
      pilot('autonomous', 1),
      pilot('autonomous', 2),
      pilot('autonomous', 3),
    ];

    expect(recommendLevel(lowRisk)).toMatchObject({
      level: 'autonomous',
      basis: 'pilot-evidence',
      confidence: 'low',
    });

    const highRisk = { ...lowRisk, riskClass: 'high' as const };
    expect(recommendLevel(highRisk).basis).toBe('owner-selected');
  });

  it('rejects evidence variants with policy events or weak outcomes', () => {
    const study = completeStudy();
    study.observations = [
      pilot('approval', 1),
      pilot('approval', 2),
      pilot('approval', 3, { policyEvent: true }),
      pilot('draft', 4),
      pilot('draft', 5, { outcome: 'fail' }),
      pilot('draft', 6, { outcome: 'fail' }),
    ];

    expect(recommendLevel(study).basis).toBe('owner-selected');
  });

  it('reports scope completeness from accountable business fields', () => {
    expect(studyCompleteness(createAutonomyStudy(null))).toEqual({
      completed: 1,
      total: 5,
      percent: 20,
      ready: false,
    });
    expect(studyCompleteness(completeStudy()).ready).toBe(true);
  });

  it('builds a redacted executable contract and an exact Tunnel task envelope', () => {
    const study = completeStudy();
    study.observations = [pilot('approval', 1), pilot('approval', 2), pilot('approval', 3)];
    const contract = buildAutonomyContract(study, 'workspace-1');
    const handoff = buildTunnelHandoff(study, 'workspace-1');

    expect(contract.kind).toBe('fetchlab.autonomy-contract');
    expect(contract.workflow.source_api).toEqual({
      request_id: 'request-1',
      name: 'Refund order',
      method: 'POST',
      url: 'https://api.example.com/refunds',
      observed_status: 200,
      observed_latency_ms: 184,
    });
    expect(JSON.stringify(contract)).not.toMatch(/authorization|api_key|password|secret/i);
    expect(contract.authority.selected_level).toBe('approval');
    expect(contract.evidence.synthetic_is_non_authorizing).toBe(true);
    expect(contract.evidence.variants.every(variant => variant.syntheticSampleSize === 0)).toBe(true);
    expect(contract.evidence.rehearsal_variants.every(variant => variant.pilotSampleSize === 0)).toBe(true);
    expect(contract.policy_rules).toHaveLength(4);

    expect(handoff).toMatchObject({
      schema_version: 1,
      source: 'fetchlab',
      kind: 'agent-tunnel.task',
      agents: [],
      budget_mode: 'standard',
    });
    expect(handoff.objective).toContain('Do not increase the selected autonomy level');
    expect(handoff.autonomy_contract).toEqual(contract);
    expect(AUTONOMY_LEVELS.map(level => level.id)).toEqual(['recommend', 'draft', 'approval', 'autonomous']);
  });
});
