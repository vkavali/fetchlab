import { loadEncryptedLocal, saveEncryptedLocal } from '../utils/localVault';

export type MissionStatus =
  | 'draft'
  | 'investigating'
  | 'needs_input'
  | 'proposed'
  | 'approving'
  | 'awaiting_validation'
  | 'ready_for_review'
  | 'validation_failed'
  | 'failed'
  | 'rejected';

export interface MissionInput {
  title: string;
  outcome: string;
  evidence: string;
  repository: string;
  app_url: string;
  source_type: string;
}

export interface MissionAvailability {
  kind?: string;
  url: string;
  reachable: boolean;
  status: number;
  status_text?: string;
  content_type?: string;
  excerpt?: string;
  duration_ms?: number;
  checked_at?: string;
  claim?: string;
}

export interface MissionProposalFile {
  path: string;
  existing?: boolean;
  original_sha?: string;
  explanation: string;
  content: string;
}

export interface MissionProposal {
  repository: string;
  default_branch: string;
  base_sha: string;
  summary: string;
  user_impact: string;
  root_cause: string;
  acceptance_criteria: string[];
  risks: string[];
  manual_review: string[];
  source_files?: Array<{ path: string; sha?: string }>;
  files: MissionProposalFile[];
  proposal_hash: string;
}

export interface MissionValidationCheck {
  name: string;
  status: string;
  conclusion?: string | null;
  url?: string | null;
}

export interface MissionValidation {
  state: 'unverified' | 'pending' | 'failed' | 'passed';
  verified: boolean;
  checks: MissionValidationCheck[];
  head_sha?: string;
  base_sha?: string | null;
  base_branch?: string | null;
  pull_request_state?: string;
  draft?: boolean;
  integrity?: { passed: boolean; failures: string[] };
  checked_at?: string;
}

export interface ProductMission {
  id: string;
  workspace_id: string;
  created_by?: string | null;
  title: string;
  status: MissionStatus;
  proposal_hash?: string | null;
  data: {
    input: MissionInput;
    investigation?: {
      repository?: string;
      default_branch?: string;
      base_sha?: string;
      selected_files?: Array<{ path: string; sha?: string }>;
      selection_reason?: string;
      questions?: string[];
      availability?: MissionAvailability | null;
      completed_at?: string;
      provider?: string;
      provider_source?: string;
    } | null;
    proposal?: MissionProposal | null;
    approval?: { approved_by: string; proposal_hash: string; approved_at: string } | null;
    pull_request?: {
      url: string;
      number: number;
      branch: string;
      head_sha?: string;
      base_sha?: string;
      repository: string;
      reused?: boolean;
    } | null;
    validation?: MissionValidation | null;
    last_error?: { message: string; code?: string; at?: string } | null;
    rejection?: { reason?: string; rejected_at?: string } | null;
  };
  created_at: string;
  updated_at: string;
}

export interface MissionEvent {
  id: string;
  mission_id: string;
  workspace_id: string;
  actor_id?: string | null;
  event_type: string;
  detail?: Record<string, unknown>;
  created_at: string;
}

export interface MissionConfig {
  github: {
    configured: boolean;
    default_repository: string;
    ready: boolean;
    source?: 'workspace' | 'server' | 'none';
    token_preview?: string;
    updated_at?: string | null;
  };
  ai: { configured: boolean; provider: string; source?: string };
  guarantees: { creates_draft_pr: boolean; merges: boolean; deploys: boolean };
}

const LOCAL_MISSIONS_KEY = 'fetchlab_product_missions_v1';

function newId() {
  return typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `mission-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export async function loadLocalMissions() {
  const missions = await loadEncryptedLocal<ProductMission[]>(LOCAL_MISSIONS_KEY, []);
  return Array.isArray(missions) ? missions : [];
}

export async function saveLocalMissions(missions: ProductMission[]) {
  await saveEncryptedLocal(LOCAL_MISSIONS_KEY, missions);
}

export async function createLocalMission(input: MissionInput) {
  const now = new Date().toISOString();
  const mission: ProductMission = {
    id: newId(),
    workspace_id: 'local',
    created_by: null,
    title: input.title,
    status: 'draft',
    proposal_hash: null,
    data: {
      input,
      investigation: null,
      proposal: null,
      approval: null,
      pull_request: null,
      validation: null,
      last_error: null,
    },
    created_at: now,
    updated_at: now,
  };
  const current = await loadLocalMissions();
  await saveLocalMissions([mission, ...current]);
  return mission;
}
