import {
  AlertTriangle,
  Ban,
  Check,
  CheckCircle2,
  Clipboard,
  Clock3,
  Code2,
  Download,
  Eye,
  FileJson,
  GitCompareArrows,
  KeyRound,
  Laptop,
  ListChecks,
  Loader2,
  LockKeyhole,
  Plus,
  RefreshCw,
  Save,
  Send,
  Server,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useAuth } from '../auth/useAuth';
import { apiUrl } from '../utils/apiBase';
import {
  canonicalize,
  createAuthorityRule,
  createLocalGate,
  emptyAuthorityPolicy,
  evaluatePolicy,
  localAuthorityDiff,
  validateAction,
  validatePolicy,
  type AuthorityAction,
  type AuthorityConstraint,
  type AuthorityCredential,
  type AuthorityDecision,
  type AuthorityDiffRow,
  type AuthorityEvent,
  type AuthorityPolicy,
  type AuthorityRule,
  type AuthorityState,
  type LocalAuthorityGate,
} from '../utils/authorityClient';
import { loadEncryptedLocal, saveEncryptedLocal } from '../utils/localVault';

type GateSection = 'connect' | 'rules' | 'decisions' | 'release';
type DecisionFilter = 'all' | 'pending' | 'blocked' | 'allowed';

interface AutonomyLabProps {
  onClose: () => void;
  onOpenAdvanced: () => void;
  onOpenRequestBuilder: () => void;
}

interface RemoteStudy {
  id: string;
  name: string;
  draft_policy?: AuthorityPolicy;
  published_revision?: number;
  updated_at?: string;
}

interface CreatedCredential {
  token: string;
  credential: AuthorityCredential;
}

const LOCAL_GATE_STORAGE = 'fetchlab_authority_gates_v1';
const RECOVERY_PREFIX = 'fetchlab_authority_draft_recovery_v1';

const SECTION_ITEMS: Array<{
  id: GateSection;
  label: string;
  icon: typeof KeyRound;
}> = [
  { id: 'connect', label: 'Connect', icon: KeyRound },
  { id: 'rules', label: 'Rules', icon: ListChecks },
  { id: 'decisions', label: 'Decisions', icon: ShieldCheck },
  { id: 'release', label: 'Release', icon: GitCompareArrows },
];

function Field({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={'gate-field ' + className}>
      <span>{label}</span>
      {children}
    </label>
  );
}

function EmptyState({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: typeof KeyRound;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="gate-empty">
      <Icon size={26} />
      <h3>{title}</h3>
      <p>{body}</p>
      {action}
    </div>
  );
}

function decisionLabel(decision: AuthorityDecision) {
  if (decision === 'require_approval') return 'Approval';
  return decision.charAt(0).toUpperCase() + decision.slice(1);
}

function decisionClass(decision: AuthorityDecision) {
  if (decision === 'allow') return 'allow';
  if (decision === 'require_approval') return 'approval';
  return 'deny';
}

function formatTime(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function stringifyConstraintValue(value: unknown) {
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

function parseConstraintValue(value: string, operator: AuthorityConstraint['operator']) {
  if (operator === 'exists') return value === 'true';
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

function fallbackCopy(value: string) {
  const textArea = document.createElement('textarea');
  textArea.value = value;
  document.body.appendChild(textArea);
  textArea.select();
  document.execCommand('copy');
  textArea.remove();
}

async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    fallbackCopy(value);
  }
}

function downloadJson(filename: string, value: unknown) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function browserFingerprint(value: unknown) {
  const bytes = new TextEncoder().encode(canonicalize(value));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

function recoveryKey(workspaceId: string | null, studyId: string) {
  return `${RECOVERY_PREFIX}:${workspaceId || 'local'}:${studyId}`;
}

async function readRecoveredPolicy(key: string) {
  try {
    const parsed = await loadEncryptedLocal<unknown>(key, null);
    return validatePolicy(parsed).valid ? parsed as AuthorityPolicy : null;
  } catch {
    return null;
  }
}

function endpointUrl(path: string) {
  const configured = apiUrl(path);
  try {
    return new URL(configured, window.location.origin).toString();
  } catch {
    return configured;
  }
}

export default function AutonomyLab({
  onClose,
  onOpenAdvanced,
  onOpenRequestBuilder,
}: AutonomyLabProps) {
  const {
    user,
    workspaces,
    activeWorkspaceId,
    serverEnabled,
    authFetch,
  } = useAuth();
  const authFetchRef = useRef(authFetch);
  const recoveryWriteRef = useRef<Promise<void>>(Promise.resolve());
  const inventoryRequestRef = useRef(0);
  const stateRequestRef = useRef(0);
  useEffect(() => {
    authFetchRef.current = authFetch;
  }, [authFetch]);
  const workspaceFetch = useCallback(async (path: string, init?: RequestInit) => {
    try {
      return await authFetchRef.current(path, init);
    } catch {
      return new Response(JSON.stringify({ error: 'FetchLab server could not be reached. Your last confirmed state is unchanged.' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }, []);

  const remoteEnabled = Boolean(user && serverEnabled && activeWorkspaceId);
  const activeWorkspace = workspaces.find(workspace => workspace.id === activeWorkspaceId);
  const workspaceRole = activeWorkspace?.member_role;
  const canEdit = !remoteEnabled || workspaceRole === 'admin' || workspaceRole === 'member';
  const canPublish = !remoteEnabled || workspaceRole === 'admin';
  const canManageCredentials = !remoteEnabled || workspaceRole === 'admin';

  const [section, setSection] = useState<GateSection>('connect');
  const [remoteStudies, setRemoteStudies] = useState<RemoteStudy[]>([]);
  const [localGates, setLocalGates] = useState<LocalAuthorityGate[]>([]);
  const [activeStudyId, setActiveStudyId] = useState('');
  const [authorityState, setAuthorityState] = useState<AuthorityState | null>(null);
  const [credentials, setCredentials] = useState<AuthorityCredential[]>([]);
  const [createdCredential, setCreatedCredential] = useState<CreatedCredential | null>(null);
  const [policyDraft, setPolicyDraft] = useState<AuthorityPolicy>(emptyAuthorityPolicy);
  const [dirty, setDirty] = useState(false);
  const dirtyRef = useRef(false);
  const [inventoryLoading, setInventoryLoading] = useState(true);
  const [stateLoading, setStateLoading] = useState(false);
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState('');
  const [tokenName, setTokenName] = useState('');
  const [showTokenForm, setShowTokenForm] = useState(false);
  const [selectedRuleId, setSelectedRuleId] = useState('');
  const [selectedEventId, setSelectedEventId] = useState('');
  const [selectedDiffEventId, setSelectedDiffEventId] = useState('');
  const [decisionFilter, setDecisionFilter] = useState<DecisionFilter>('all');
  const [localActionText, setLocalActionText] = useState('');
  const [localResult, setLocalResult] = useState<AuthorityEvent | null>(null);

  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);

  const loadInventory = useCallback(async () => {
    const requestId = ++inventoryRequestRef.current;
    setInventoryLoading(true);
    setError('');
    if (!remoteEnabled || !activeWorkspaceId) {
      try {
        const stored = await loadEncryptedLocal<LocalAuthorityGate[]>(LOCAL_GATE_STORAGE, []);
        if (requestId !== inventoryRequestRef.current) return;
        setLocalGates(Array.isArray(stored) ? stored : []);
        setActiveStudyId(current => (
          current && stored.some(gate => gate.id === current) ? current : stored[0]?.id || ''
        ));
      } catch {
        if (requestId !== inventoryRequestRef.current) return;
        setLocalGates([]);
        setError('Encrypted local data could not be opened. The stored payload may have changed.');
      } finally {
        if (requestId === inventoryRequestRef.current) setInventoryLoading(false);
      }
      return;
    }

    const [studiesResponse, credentialsResponse] = await Promise.all([
      workspaceFetch(`/api/workspaces/${encodeURIComponent(activeWorkspaceId)}/autonomy-studies`),
      canManageCredentials
        ? workspaceFetch(`/api/workspaces/${encodeURIComponent(activeWorkspaceId)}/authority-tokens`)
        : Promise.resolve(null),
    ]);
    if (requestId !== inventoryRequestRef.current) return;
    if (!studiesResponse.ok) {
      const payload = await studiesResponse.json().catch(() => ({})) as { error?: string };
      if (requestId !== inventoryRequestRef.current) return;
      setError(payload.error || 'Action gates could not be loaded.');
      setInventoryLoading(false);
      return;
    }
    const studiesPayload = await studiesResponse.json() as { studies?: RemoteStudy[] };
    if (requestId !== inventoryRequestRef.current) return;
    const studies = studiesPayload.studies || [];
    setRemoteStudies(studies);
    setActiveStudyId(current => (
      current && studies.some(study => study.id === current) ? current : studies[0]?.id || ''
    ));
    if (credentialsResponse?.ok) {
      const credentialPayload = await credentialsResponse.json() as { credentials?: AuthorityCredential[] };
      if (requestId !== inventoryRequestRef.current) return;
      setCredentials(credentialPayload.credentials || []);
    } else {
      setCredentials([]);
    }
    if (requestId === inventoryRequestRef.current) setInventoryLoading(false);
  }, [activeWorkspaceId, canManageCredentials, remoteEnabled, workspaceFetch]);

  useEffect(() => {
    void loadInventory();
  }, [loadInventory]);

  const refreshRemoteState = useCallback(async (loadDraft: boolean) => {
    const requestId = ++stateRequestRef.current;
    if (!remoteEnabled || !activeWorkspaceId || !activeStudyId) {
      setStateLoading(false);
      return;
    }
    setStateLoading(true);
    const response = await workspaceFetch(
      `/api/workspaces/${encodeURIComponent(activeWorkspaceId)}/autonomy-studies/${encodeURIComponent(activeStudyId)}/authority`,
    );
    if (requestId !== stateRequestRef.current) return;
    if (!response.ok) {
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (requestId !== stateRequestRef.current) return;
      setError(payload.error || 'Gate state could not be loaded.');
      setStateLoading(false);
      return;
    }
    const nextState = await response.json() as AuthorityState;
    const recovered = loadDraft
      ? await readRecoveredPolicy(recoveryKey(activeWorkspaceId, activeStudyId))
      : null;
    if (requestId !== stateRequestRef.current) return;
    setAuthorityState(nextState);
    if (loadDraft) {
      setPolicyDraft(recovered || nextState.study.draft_policy);
      setDirty(Boolean(recovered && canonicalize(recovered) !== canonicalize(nextState.study.draft_policy)));
    } else if (!dirtyRef.current) {
      setPolicyDraft(nextState.study.draft_policy);
    }
    setSelectedEventId(current => (
      current && nextState.events.some(event => event.event_id === current)
        ? current
        : nextState.events.find(event => event.review_status === 'pending')?.event_id || nextState.events[0]?.event_id || ''
    ));
    setSelectedDiffEventId(current => (
      current && nextState.diff.rows.some(row => row.eventId === current)
        ? current
        : nextState.diff.rows.find(row => row.change === 'expansion')?.eventId || nextState.diff.rows[0]?.eventId || ''
    ));
    setStateLoading(false);
  }, [activeStudyId, activeWorkspaceId, remoteEnabled, workspaceFetch]);

  useEffect(() => {
    if (remoteEnabled) {
      void refreshRemoteState(true);
      return;
    }
    stateRequestRef.current += 1;
    setStateLoading(false);
    const gate = localGates.find(item => item.id === activeStudyId);
    if (!gate) {
      setAuthorityState(null);
      setPolicyDraft(emptyAuthorityPolicy());
      setDirty(false);
      return;
    }
    let cancelled = false;
    setPolicyDraft(gate.draftPolicy);
    setDirty(false);
    void readRecoveredPolicy(recoveryKey(null, gate.id)).then((recovered) => {
      if (cancelled) return;
      setPolicyDraft(recovered || gate.draftPolicy);
      setDirty(Boolean(recovered && canonicalize(recovered) !== canonicalize(gate.draftPolicy)));
    });
    setSelectedEventId(current => (
      current && gate.events.some(event => event.event_id === current) ? current : gate.events[0]?.event_id || ''
    ));
    return () => {
      cancelled = true;
    };
  }, [activeStudyId, localGates, refreshRemoteState, remoteEnabled]);

  useEffect(() => {
    if (!activeStudyId || !dirty) return;
    const key = recoveryKey(remoteEnabled ? activeWorkspaceId : null, activeStudyId);
    recoveryWriteRef.current = recoveryWriteRef.current
      .then(() => saveEncryptedLocal(key, policyDraft))
      .catch(() => undefined);
  }, [activeStudyId, activeWorkspaceId, dirty, policyDraft, remoteEnabled]);

  useEffect(() => {
    if (!policyDraft.rules.length) {
      setSelectedRuleId('');
      return;
    }
    setSelectedRuleId(current => (
      policyDraft.rules.some(rule => rule.id === current) ? current : policyDraft.rules[0].id
    ));
  }, [policyDraft.rules]);

  const activeRemoteStudy = remoteStudies.find(study => study.id === activeStudyId);
  const activeLocalGate = localGates.find(gate => gate.id === activeStudyId);
  const activeGateName = remoteEnabled
    ? authorityState?.study.name || activeRemoteStudy?.name || ''
    : activeLocalGate?.name || '';
  const publishedRevision = remoteEnabled
    ? authorityState?.study.published_revision || 0
    : activeLocalGate?.publishedRevision || 0;
  const publishedPolicy = remoteEnabled
    ? authorityState?.published?.policy || null
    : activeLocalGate?.publishedPolicy || null;
  const events = remoteEnabled ? authorityState?.events || [] : activeLocalGate?.events || [];
  const pendingCount = events.filter(event => event.review_status === 'pending').length;

  const localDiff = useMemo(() => (
    activeLocalGate
      ? localAuthorityDiff({ ...activeLocalGate, draftPolicy: policyDraft })
      : { rows: [], expansions: [], restrictions: [], unchanged: [] }
  ), [activeLocalGate, policyDraft]);

  const diffRows: AuthorityDiffRow[] = remoteEnabled
    ? authorityState?.diff.rows || []
    : localDiff.rows.map(row => ({ ...row, review: null }));
  const expansionCount = remoteEnabled
    ? authorityState?.diff.expansion_count || 0
    : localDiff.expansions.length;
  const restrictionCount = remoteEnabled
    ? authorityState?.diff.restriction_count || 0
    : localDiff.restrictions.length;
  const unresolvedExpansionCount = remoteEnabled
    ? authorityState?.diff.unresolved_expansion_count || 0
    : expansionCount;
  const selectedRule = policyDraft.rules.find(rule => rule.id === selectedRuleId) || null;
  const selectedEvent = events.find(event => event.event_id === selectedEventId) || null;
  const selectedDiff = diffRows.find(row => row.eventId === selectedDiffEventId) || null;
  const selectedDiffEvent = events.find(event => event.event_id === selectedDiff?.eventId) || null;

  const filteredEvents = events.filter(event => {
    if (decisionFilter === 'pending') return event.review_status === 'pending';
    if (decisionFilter === 'blocked') return event.decision === 'deny';
    if (decisionFilter === 'allowed') return event.decision === 'allow';
    return true;
  });

  const runtimeEndpoint = endpointUrl('/api/authority/check');
  const integrationToken = createdCredential?.token || 'flk_REPLACE_WITH_RUNTIME_CREDENTIAL';
  const integrationSnippet = activeStudyId ? `const gateUrl = '${runtimeEndpoint}';
const action = {
  agent_id: 'your-agent',
  session_id: 'run-id',
  tool: 'provider.tool',
  operation: 'write',
  target: 'provider://resource/id',
  arguments: {},
  reversible: false
};
const headers = {
  'Authorization': 'Bearer ${integrationToken}',
  'Content-Type': 'application/json'
};

const response = await fetch(gateUrl, {
  method: 'POST',
  headers: {
    ...headers,
    'Idempotency-Key': crypto.randomUUID()
  },
  body: JSON.stringify({
    study_id: '${activeStudyId}',
    action
  })
});

if (!response.ok) throw new Error('FetchLab gate unavailable');
let decision = await response.json();

if (decision.decision === 'require_approval' && !decision.execute) {
  const eventUrl = new URL('./events/' + decision.event_id, gateUrl).toString();
  const statusResponse = await fetch(eventUrl, { headers });
  const status = await statusResponse.json();
  if (status.review_status !== 'approved') return status;

  const consumeResponse = await fetch(eventUrl + '/consume', {
    method: 'POST',
    headers,
    body: JSON.stringify({ action })
  });
  decision = await consumeResponse.json();
}

if (!decision.execute) return decision;
// Execute this exact action now. Treat every gate error as fail-closed.` : '';

  function changePolicy(transform: (current: AuthorityPolicy) => AuthorityPolicy) {
    if (!canEdit) return;
    setPolicyDraft(current => transform(current));
    setDirty(true);
    setNotice('');
    setError('');
  }

  async function clearRecovery(key: string) {
    await recoveryWriteRef.current.catch(() => undefined);
    localStorage.removeItem(key);
  }

  function confirmDiscardDraft() {
    return !dirty || window.confirm('Leave this gate with an unsaved draft? The encrypted recovery copy will remain on this device.');
  }

  function requestClose() {
    if (confirmDiscardDraft()) onClose();
  }

  function updateRule(ruleId: string, patch: Partial<AuthorityRule>) {
    changePolicy(current => ({
      ...current,
      rules: current.rules.map(rule => rule.id === ruleId ? { ...rule, ...patch } : rule),
    }));
  }

  function updateConstraint(ruleId: string, index: number, patch: Partial<AuthorityConstraint>) {
    const rule = policyDraft.rules.find(item => item.id === ruleId);
    if (!rule) return;
    updateRule(ruleId, {
      constraints: rule.constraints.map((constraint, position) => (
        position === index ? { ...constraint, ...patch } : constraint
      )),
    });
  }

  function addRule() {
    const rule = createAuthorityRule();
    changePolicy(current => ({ ...current, rules: [...current.rules, rule] }));
    setSelectedRuleId(rule.id);
  }

  function removeRule(ruleId: string) {
    changePolicy(current => ({ ...current, rules: current.rules.filter(rule => rule.id !== ruleId) }));
  }

  async function persistLocal(next: LocalAuthorityGate[]) {
    await saveEncryptedLocal(LOCAL_GATE_STORAGE, next);
    setLocalGates(next);
  }

  async function createGate() {
    if (!canEdit) return;
    const name = createName.trim();
    if (!name) {
      setError('Gate name is required.');
      return;
    }
    setBusy('create');
    setError('');
    if (!remoteEnabled || !activeWorkspaceId) {
      try {
        const gate = createLocalGate(name);
        const next = [gate, ...localGates];
        await persistLocal(next);
        setActiveStudyId(gate.id);
        setShowCreate(false);
        setCreateName('');
        setSection('rules');
        setNotice('Encrypted local gate created.');
      } catch {
        setError('The local gate could not be encrypted and saved.');
      } finally {
        setBusy('');
      }
      return;
    }
    const response = await workspaceFetch(
      `/api/workspaces/${encodeURIComponent(activeWorkspaceId)}/autonomy-studies`,
      {
        method: 'POST',
        body: JSON.stringify({
          name,
          status: 'draft',
          data: { product: 'authority_gate', version: 1 },
        }),
      },
    );
    const payload = await response.json().catch(() => ({})) as { study?: RemoteStudy; error?: string };
    if (!response.ok || !payload.study) {
      setError(payload.error || 'Gate could not be created.');
      setBusy('');
      return;
    }
    setRemoteStudies(current => [payload.study as RemoteStudy, ...current]);
    setActiveStudyId(payload.study.id);
    setShowCreate(false);
    setCreateName('');
    setSection('rules');
    setNotice('Workspace gate created.');
    setBusy('');
  }

  async function deleteGate() {
    if (!canPublish) return;
    if (!activeStudyId || !window.confirm(`Delete "${activeGateName}"? Decision evidence and policy revisions will be removed.`)) return;
    setBusy('delete');
    if (!remoteEnabled || !activeWorkspaceId) {
      try {
        const next = localGates.filter(gate => gate.id !== activeStudyId);
        await persistLocal(next);
        await clearRecovery(recoveryKey(null, activeStudyId));
        setActiveStudyId(next[0]?.id || '');
        setNotice('Local gate deleted.');
      } catch {
        setError('Local gate could not be deleted.');
      } finally {
        setBusy('');
      }
      return;
    }
    const response = await workspaceFetch(
      `/api/workspaces/${encodeURIComponent(activeWorkspaceId)}/autonomy-studies/${encodeURIComponent(activeStudyId)}`,
      { method: 'DELETE' },
    );
    if (!response.ok) {
      const payload = await response.json().catch(() => ({})) as { error?: string };
      setError(payload.error || 'Gate could not be deleted.');
      setBusy('');
      return;
    }
    await clearRecovery(recoveryKey(activeWorkspaceId, activeStudyId));
    const next = remoteStudies.filter(study => study.id !== activeStudyId);
    setRemoteStudies(next);
    setActiveStudyId(next[0]?.id || '');
    setAuthorityState(null);
    setNotice('Workspace gate deleted.');
    setBusy('');
  }

  async function saveDraft() {
    if (!canEdit) return;
    const validation = validatePolicy(policyDraft);
    if (!validation.valid) {
      setError(validation.errors[0]?.message || 'Policy is invalid.');
      return;
    }
    setBusy('save');
    setError('');
    if (!remoteEnabled || !activeLocalGate) {
      if (!activeLocalGate) {
        setBusy('');
        return;
      }
      try {
        const now = new Date().toISOString();
        const next = localGates.map(gate => (
          gate.id === activeLocalGate.id ? { ...gate, draftPolicy: policyDraft, updatedAt: now } : gate
        ));
        await persistLocal(next);
        await clearRecovery(recoveryKey(null, activeLocalGate.id));
        setDirty(false);
        setNotice('Draft encrypted and saved on this device.');
      } catch {
        setError('Draft could not be encrypted and saved.');
      } finally {
        setBusy('');
      }
      return;
    }
    if (!activeWorkspaceId) {
      setBusy('');
      return;
    }
    const response = await workspaceFetch(
      `/api/workspaces/${encodeURIComponent(activeWorkspaceId)}/autonomy-studies/${encodeURIComponent(activeStudyId)}/authority/draft`,
      { method: 'PUT', body: JSON.stringify({ policy: policyDraft }) },
    );
    const payload = await response.json().catch(() => ({})) as { error?: string; fields?: Array<{ message: string }> };
    if (!response.ok) {
      setError(payload.fields?.[0]?.message || payload.error || 'Draft could not be saved.');
      setBusy('');
      return;
    }
    await clearRecovery(recoveryKey(activeWorkspaceId, activeStudyId));
    setDirty(false);
    setNotice('Draft saved to the workspace.');
    setBusy('');
    await refreshRemoteState(false);
  }

  async function createRuntimeCredential() {
    if (!remoteEnabled || !activeWorkspaceId || !canManageCredentials) return;
    const name = tokenName.trim() || `${activeGateName || 'Agent gate'} runtime`;
    setBusy('credential');
    const response = await workspaceFetch(
      `/api/workspaces/${encodeURIComponent(activeWorkspaceId)}/authority-tokens`,
      { method: 'POST', body: JSON.stringify({ name }) },
    );
    const payload = await response.json().catch(() => ({})) as CreatedCredential & { error?: string };
    if (!response.ok || !payload.token || !payload.credential) {
      setError(payload.error || 'Runtime credential could not be created.');
      setBusy('');
      return;
    }
    setCreatedCredential({ token: payload.token, credential: payload.credential });
    setCredentials(current => [payload.credential, ...current]);
    setShowTokenForm(false);
    setTokenName('');
    setNotice('Credential created. Copy it now; FetchLab will not show it again.');
    setBusy('');
  }

  async function revokeCredential(credential: AuthorityCredential) {
    if (!remoteEnabled || !activeWorkspaceId || !canManageCredentials || !window.confirm(`Revoke "${credential.name}"?`)) return;
    setBusy(`revoke:${credential.id}`);
    const response = await workspaceFetch(
      `/api/workspaces/${encodeURIComponent(activeWorkspaceId)}/authority-tokens/${encodeURIComponent(credential.id)}`,
      { method: 'DELETE' },
    );
    if (!response.ok) {
      setError('Credential could not be revoked.');
      setBusy('');
      return;
    }
    setCredentials(current => current.map(item => (
      item.id === credential.id ? { ...item, revoked_at: new Date().toISOString() } : item
    )));
    if (createdCredential?.credential.id === credential.id) setCreatedCredential(null);
    setNotice('Runtime credential revoked.');
    setBusy('');
  }

  async function reviewDecision(verdict: 'approved' | 'denied') {
    if (!remoteEnabled || !activeWorkspaceId || !selectedEvent || !canEdit) return;
    setBusy('decision-review');
    const response = await workspaceFetch(
      `/api/workspaces/${encodeURIComponent(activeWorkspaceId)}/autonomy-studies/${encodeURIComponent(activeStudyId)}/authority/events/${encodeURIComponent(selectedEvent.event_id)}/review`,
      {
        method: 'POST',
        body: JSON.stringify({ verdict, expires_in_seconds: 900 }),
      },
    );
    const payload = await response.json().catch(() => ({})) as { error?: string };
    if (!response.ok) {
      setError(payload.error || 'Decision could not be reviewed.');
      setBusy('');
      return;
    }
    setNotice(verdict === 'approved' ? 'Action approved for one use.' : 'Action denied.');
    setBusy('');
    await refreshRemoteState(false);
  }

  async function reviewExpansion(verdict: 'approved' | 'rejected') {
    if (!remoteEnabled || !activeWorkspaceId || !authorityState || !selectedDiff || !canEdit) return;
    setBusy('expansion-review');
    const response = await workspaceFetch(
      `/api/workspaces/${encodeURIComponent(activeWorkspaceId)}/autonomy-studies/${encodeURIComponent(activeStudyId)}/authority/expansions/${encodeURIComponent(selectedDiff.eventId)}/review`,
      {
        method: 'POST',
        body: JSON.stringify({
          draft_fingerprint: authorityState.draft_fingerprint,
          verdict,
        }),
      },
    );
    const payload = await response.json().catch(() => ({})) as { error?: string };
    if (!response.ok) {
      setError(payload.error || 'Expansion review could not be saved.');
      setBusy('');
      return;
    }
    setNotice(verdict === 'approved' ? 'Authority expansion approved.' : 'Expansion rejected. Change the draft before release.');
    setBusy('');
    await refreshRemoteState(false);
  }

  async function publishPolicy() {
    if (!remoteEnabled || !activeWorkspaceId || !authorityState || !canPublish) return;
    if (dirty) {
      setError('Save the draft before publishing.');
      return;
    }
    setBusy('publish');
    const response = await workspaceFetch(
      `/api/workspaces/${encodeURIComponent(activeWorkspaceId)}/autonomy-studies/${encodeURIComponent(activeStudyId)}/authority/publish`,
      {
        method: 'POST',
        body: JSON.stringify({ expected_revision: authorityState.study.published_revision }),
      },
    );
    const payload = await response.json().catch(() => ({})) as {
      error?: string;
      current_revision?: number;
      revision?: { revision?: number };
      unchanged?: boolean;
    };
    if (!response.ok) {
      setError(payload.error || 'Policy could not be published.');
      setBusy('');
      await refreshRemoteState(false);
      return;
    }
    setNotice(payload.unchanged ? 'Draft already matches the published policy.' : `Policy revision ${payload.revision?.revision} published.`);
    setBusy('');
    await refreshRemoteState(false);
  }

  async function snapshotLocalPolicy() {
    if (!activeLocalGate) return;
    const validation = validatePolicy(policyDraft, { requireEnabledRule: true });
    if (!validation.valid) {
      setError(validation.errors[0]?.message || 'Policy cannot be saved as a local revision.');
      return;
    }
    setBusy('publish');
    try {
      const next = localGates.map(gate => (
        gate.id === activeLocalGate.id
          ? {
            ...gate,
            draftPolicy: policyDraft,
            publishedPolicy: policyDraft,
            publishedRevision: gate.publishedRevision + 1,
            updatedAt: new Date().toISOString(),
          }
          : gate
      ));
      await persistLocal(next);
      await clearRecovery(recoveryKey(null, activeLocalGate.id));
      setDirty(false);
      setNotice(`Local simulation revision ${activeLocalGate.publishedRevision + 1} saved.`);
    } catch {
      setError('Local revision could not be encrypted and saved.');
    } finally {
      setBusy('');
    }
  }

  async function simulateLocalAction() {
    if (!activeLocalGate) return;
    setError('');
    let action: AuthorityAction;
    try {
      action = JSON.parse(localActionText) as AuthorityAction;
    } catch {
      setError('Action packet must be valid JSON.');
      return;
    }
    const validation = validateAction(action);
    if (!validation.valid) {
      setError(validation.errors[0]?.message || 'Action packet is invalid.');
      return;
    }
    setBusy('simulate');
    try {
      const policy = activeLocalGate.publishedPolicy || policyDraft;
      const evaluation = evaluatePolicy(policy, action);
      const now = new Date().toISOString();
      const event: AuthorityEvent = {
        event_id: `local_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
        study_id: activeLocalGate.id,
        agent_id: action.agent_id,
        session_id: action.session_id || null,
        action,
        action_hash: await browserFingerprint(action),
        decision: evaluation.decision,
        execute: policy.mode === 'shadow' || evaluation.decision === 'allow',
        mode: policy.mode,
        reason: evaluation.reason,
        matched_rule_id: evaluation.matchedRuleId,
        policy_revision: activeLocalGate.publishedPolicy ? activeLocalGate.publishedRevision : 0,
        policy_fingerprint: await browserFingerprint(policy),
        review_status: policy.mode === 'shadow'
          ? 'shadow'
          : evaluation.decision === 'require_approval' ? 'pending' : 'not_required',
        approval_expires_at: null,
        consumed_at: null,
        created_at: now,
        source: 'local_simulation',
      };
      const next = localGates.map(gate => (
        gate.id === activeLocalGate.id
          ? { ...gate, events: [event, ...gate.events], updatedAt: now }
          : gate
      ));
      await persistLocal(next);
      setLocalResult(event);
      setSelectedEventId(event.event_id);
      setNotice('Local simulation recorded. It is not runtime evidence.');
    } catch {
      setError('Local simulation could not be encrypted and saved.');
    } finally {
      setBusy('');
    }
  }

  function renderConnect() {
    if (!remoteEnabled) {
      return (
        <div className="gate-workspace">
          <main className="gate-pane gate-pane-main">
            <div className="gate-page-heading">
              <div>
                <span className="gate-kicker">Device simulation</span>
                <h2>Test an exact action packet</h2>
              </div>
              <button className="gate-button gate-button-secondary" onClick={onOpenRequestBuilder}>
                <Send size={16} /> API Workbench
              </button>
            </div>
            <div className="gate-system-band warning">
              <Laptop size={18} />
              <div>
                <strong>No shared runtime endpoint</strong>
                <span>Policies and action packets are AES-GCM encrypted on this device. Team review and server enforcement are unavailable.</span>
              </div>
            </div>
            <Field label="Action packet JSON">
              <textarea
                className="gate-code-input"
                rows={15}
                value={localActionText}
                onChange={event => setLocalActionText(event.target.value)}
                placeholder={'{\n  "agent_id": "refund-agent",\n  "tool": "stripe.refunds.create",\n  "operation": "write",\n  "target": "stripe://charges/ch_123/refund",\n  "arguments": { "amount": 75 },\n  "reversible": false\n}'}
              />
            </Field>
            <div className="gate-action-row">
              <button
                className="gate-button gate-button-primary"
                disabled={!localActionText.trim() || busy === 'simulate'}
                onClick={() => void simulateLocalAction()}
              >
                {busy === 'simulate' ? <Loader2 size={16} className="animate-spin" /> : <Eye size={16} />}
                Preview decision
              </button>
            </div>
          </main>
          <aside className="gate-pane gate-inspector">
            <div className="gate-inspector-heading">
              <span className="gate-kicker">Latest preview</span>
              <h3>{localResult ? decisionLabel(localResult.decision) : 'No result'}</h3>
            </div>
            {localResult ? (
              <>
                <div className={'gate-decision-banner ' + decisionClass(localResult.decision)}>
                  {localResult.execute ? <CheckCircle2 size={18} /> : <Ban size={18} />}
                  <div>
                    <strong>{localResult.execute ? 'Would execute' : 'Would stop'}</strong>
                    <span>{localResult.reason}</span>
                  </div>
                </div>
                <dl className="gate-detail-list">
                  <div><dt>Mode</dt><dd>{localResult.mode}</dd></div>
                  <div><dt>Revision</dt><dd>{localResult.policy_revision || 'Draft'}</dd></div>
                  <div><dt>Rule</dt><dd>{localResult.matched_rule_id || 'Default deny'}</dd></div>
                  <div><dt>Source</dt><dd>Local simulation</dd></div>
                </dl>
              </>
            ) : (
              <EmptyState
                icon={FileJson}
                title="Paste a real action"
                body="The preview uses the saved local revision, or the current draft when no revision exists."
              />
            )}
          </aside>
        </div>
      );
    }

    return (
      <div className="gate-workspace">
        <main className="gate-pane gate-pane-main">
          <div className="gate-page-heading">
            <div>
              <span className="gate-kicker">Runtime connection</span>
              <h2>Connect an agent</h2>
            </div>
            {canManageCredentials && (
              <button className="gate-button gate-button-secondary" onClick={() => setShowTokenForm(true)}>
                <Plus size={16} /> New credential
              </button>
            )}
          </div>

          {createdCredential && (
            <div className="gate-credential-reveal">
              <div>
                <span>Copy now</span>
                <strong>{createdCredential.credential.name}</strong>
                <code>{createdCredential.token}</code>
              </div>
              <button
                className="gate-icon-button"
                title="Copy runtime credential"
                aria-label="Copy runtime credential"
                onClick={() => void copyText(createdCredential.token).then(() => setNotice('Credential copied.'))}
              >
                <Clipboard size={17} />
              </button>
              <button
                className="gate-icon-button"
                title="Hide runtime credential"
                aria-label="Hide runtime credential"
                onClick={() => setCreatedCredential(null)}
              >
                <X size={17} />
              </button>
            </div>
          )}

          <div className="gate-section-heading">
            <div>
              <h3>Runtime credentials</h3>
              <span>{credentials.filter(item => !item.revoked_at).length} active</span>
            </div>
          </div>
          {!credentials.length ? (
            <EmptyState
              icon={KeyRound}
              title={canManageCredentials ? 'No runtime credential' : 'Credentials managed by admins'}
              body={canManageCredentials
                ? 'Create one credential for the agent environment that will ask FetchLab before taking actions.'
                : 'Workspace administrators create, rotate, and revoke runtime credentials.'}
              action={canManageCredentials ? (
                <button className="gate-button gate-button-primary" onClick={() => setShowTokenForm(true)}>
                  <Plus size={16} /> Create credential
                </button>
              ) : undefined}
            />
          ) : (
            <div className="gate-table-wrap">
              <table className="gate-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Prefix</th>
                    <th>Last used</th>
                    <th>Status</th>
                    <th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {credentials.map(credential => (
                    <tr key={credential.id}>
                      <td><strong>{credential.name}</strong></td>
                      <td><code>{credential.token_prefix}</code></td>
                      <td>{formatTime(credential.last_used_at)}</td>
                      <td>
                        <span className={'gate-status ' + (credential.revoked_at ? 'neutral' : 'allow')}>
                          {credential.revoked_at ? 'Revoked' : 'Active'}
                        </span>
                      </td>
                      <td>
                        <button
                          className="gate-icon-button"
                          disabled={Boolean(credential.revoked_at) || busy === `revoke:${credential.id}`}
                          title="Revoke credential"
                          aria-label="Revoke credential"
                          onClick={() => void revokeCredential(credential)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </main>
        <aside className="gate-pane gate-inspector">
          <div className="gate-inspector-heading">
            <span className="gate-kicker">Decision API</span>
            <h3>Integration contract</h3>
          </div>
          <div className="gate-endpoint">
            <span>POST</span>
            <code>{runtimeEndpoint}</code>
            <button
              className="gate-icon-button"
              title="Copy endpoint"
              aria-label="Copy endpoint"
              onClick={() => void copyText(runtimeEndpoint).then(() => setNotice('Endpoint copied.'))}
            >
              <Clipboard size={15} />
            </button>
          </div>
          <pre className="gate-code-block">{integrationSnippet}</pre>
          <button
            className="gate-button gate-button-secondary gate-full-button"
            onClick={() => void copyText(integrationSnippet).then(() => setNotice('Integration code copied.'))}
          >
            <Clipboard size={16} /> Copy integration
          </button>
          <dl className="gate-detail-list">
            <div><dt>Workspace</dt><dd>{activeWorkspace?.name || 'Workspace'}</dd></div>
            <div><dt>Gate ID</dt><dd><code>{activeStudyId}</code></dd></div>
            <div><dt>Published</dt><dd>{publishedRevision ? `Revision ${publishedRevision}` : 'Not published'}</dd></div>
            <div><dt>Retry safety</dt><dd>Idempotency key required</dd></div>
          </dl>
        </aside>
      </div>
    );
  }

  function renderRules() {
    return (
      <div className="gate-workspace gate-workspace-rule">
        <main className="gate-pane gate-pane-main">
          <div className="gate-page-heading">
            <div>
              <span className="gate-kicker">Draft policy</span>
              <h2>Action rules</h2>
            </div>
            <div className="gate-heading-actions">
              <div className="gate-segmented" aria-label="Policy mode">
                <button
                  className={policyDraft.mode === 'shadow' ? 'active' : ''}
                  disabled={!canEdit}
                  onClick={() => changePolicy(current => ({ ...current, mode: 'shadow' }))}
                >
                  Shadow
                </button>
                <button
                  className={policyDraft.mode === 'enforce' ? 'active' : ''}
                  disabled={!canEdit}
                  onClick={() => changePolicy(current => ({ ...current, mode: 'enforce' }))}
                >
                  Enforce
                </button>
              </div>
              <button className="gate-button gate-button-secondary" disabled={!canEdit} onClick={addRule}>
                <Plus size={16} /> Add rule
              </button>
              <button
                className="gate-button gate-button-primary"
                disabled={!canEdit || !dirty || busy === 'save'}
                onClick={() => void saveDraft()}
              >
                {busy === 'save' ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                Save draft
              </button>
            </div>
          </div>
          <div className="gate-system-band">
            <LockKeyhole size={18} />
            <div>
              <strong>Default deny</strong>
              <span>When no enabled rule matches, the action is denied. Deny overrides approval; approval overrides allow.</span>
            </div>
          </div>
          {!canEdit && (
            <div className="gate-system-band warning">
              <Eye size={18} />
              <div>
                <strong>Viewer access</strong>
                <span>You can inspect policy and evidence. A member or admin must change the draft.</span>
              </div>
            </div>
          )}
          {!policyDraft.rules.length ? (
            <EmptyState
              icon={ListChecks}
              title="No rules in this draft"
              body="Add the first explicit tool and target boundary. The gate cannot be published with an empty policy."
              action={(
                <button className="gate-button gate-button-primary" disabled={!canEdit} onClick={addRule}>
                  <Plus size={16} /> Add first rule
                </button>
              )}
            />
          ) : (
            <div className="gate-table-wrap">
              <table className="gate-table gate-rule-table">
                <thead>
                  <tr>
                    <th>On</th>
                    <th>Rule</th>
                    <th>Decision</th>
                    <th>Tool</th>
                    <th>Operation</th>
                    <th>Target</th>
                    <th>Limits</th>
                  </tr>
                </thead>
                <tbody>
                  {policyDraft.rules.map(rule => (
                    <tr
                      key={rule.id}
                      className={rule.id === selectedRuleId ? 'selected' : ''}
                      onClick={() => setSelectedRuleId(rule.id)}
                    >
                      <td>
                        <input
                          type="checkbox"
                          checked={rule.enabled}
                          disabled={!canEdit}
                          aria-label={`Enable ${rule.name}`}
                          onClick={event => event.stopPropagation()}
                          onChange={event => updateRule(rule.id, { enabled: event.target.checked })}
                        />
                      </td>
                      <td><strong>{rule.name}</strong></td>
                      <td><span className={'gate-status ' + decisionClass(rule.effect)}>{decisionLabel(rule.effect)}</span></td>
                      <td><code>{rule.toolPattern}</code></td>
                      <td>{rule.operation}</td>
                      <td><code>{rule.targetPattern}</code></td>
                      <td>{rule.constraints.length}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </main>
        <aside className="gate-pane gate-inspector">
          {selectedRule ? (
            <>
              <div className="gate-inspector-heading gate-inspector-heading-row">
                <div>
                  <span className="gate-kicker">Rule inspector</span>
                  <h3>{selectedRule.name}</h3>
                </div>
                <button
                  className="gate-icon-button danger"
                  disabled={!canEdit}
                  title="Delete rule"
                  aria-label="Delete rule"
                  onClick={() => removeRule(selectedRule.id)}
                >
                  <Trash2 size={16} />
                </button>
              </div>
              <div className="gate-inspector-form">
                <Field label="Rule name">
                  <input disabled={!canEdit} value={selectedRule.name} onChange={event => updateRule(selectedRule.id, { name: event.target.value })} />
                </Field>
                <Field label="Decision">
                  <select
                    disabled={!canEdit}
                    value={selectedRule.effect}
                    onChange={event => updateRule(selectedRule.id, { effect: event.target.value as AuthorityDecision })}
                  >
                    <option value="allow">Allow</option>
                    <option value="require_approval">Require approval</option>
                    <option value="deny">Deny</option>
                  </select>
                </Field>
                <Field label="Tool pattern">
                  <input
                    disabled={!canEdit}
                    value={selectedRule.toolPattern}
                    onChange={event => updateRule(selectedRule.id, { toolPattern: event.target.value })}
                    placeholder="stripe.refunds.*"
                  />
                </Field>
                <Field label="Operation">
                  <select
                    disabled={!canEdit}
                    value={selectedRule.operation}
                    onChange={event => updateRule(selectedRule.id, { operation: event.target.value as AuthorityRule['operation'] })}
                  >
                    <option value="*">Any operation</option>
                    <option value="read">Read</option>
                    <option value="write">Write</option>
                    <option value="delete">Delete</option>
                    <option value="execute">Execute</option>
                    <option value="unknown">Unknown</option>
                  </select>
                </Field>
                <Field label="Target pattern">
                  <input
                    disabled={!canEdit}
                    value={selectedRule.targetPattern}
                    onChange={event => updateRule(selectedRule.id, { targetPattern: event.target.value })}
                    placeholder="stripe://charges/*/refund"
                  />
                </Field>
              </div>
              <div className="gate-inspector-section">
                <div className="gate-section-heading">
                  <div>
                    <h4>Argument limits</h4>
                    <span>{selectedRule.constraints.length}</span>
                  </div>
                  <button
                    className="gate-icon-button"
                    disabled={!canEdit}
                    title="Add argument limit"
                    aria-label="Add argument limit"
                    onClick={() => updateRule(selectedRule.id, {
                      constraints: [
                        ...selectedRule.constraints,
                        { path: 'amount', operator: 'lte', value: 100 },
                      ],
                    })}
                  >
                    <Plus size={16} />
                  </button>
                </div>
                {!selectedRule.constraints.length ? (
                  <p className="gate-muted">No argument limits. Tool, operation, and target still apply.</p>
                ) : selectedRule.constraints.map((constraint, index) => (
                  <div className="gate-constraint" key={`${selectedRule.id}:${index}`}>
                    <input
                      disabled={!canEdit}
                      aria-label="Argument path"
                      value={constraint.path}
                      onChange={event => updateConstraint(selectedRule.id, index, { path: event.target.value })}
                      placeholder="amount"
                    />
                    <select
                      disabled={!canEdit}
                      aria-label="Constraint operator"
                      value={constraint.operator}
                      onChange={event => {
                        const operator = event.target.value as AuthorityConstraint['operator'];
                        updateConstraint(selectedRule.id, index, {
                          operator,
                          value: operator === 'exists' ? true : constraint.value,
                        });
                      }}
                    >
                      <option value="eq">equals</option>
                      <option value="neq">not equal</option>
                      <option value="lt">less than</option>
                      <option value="lte">at most</option>
                      <option value="gt">greater than</option>
                      <option value="gte">at least</option>
                      <option value="in">in list</option>
                      <option value="contains">contains</option>
                      <option value="exists">exists</option>
                    </select>
                    {constraint.operator === 'exists' ? (
                      <select
                        disabled={!canEdit}
                        aria-label="Exists value"
                        value={String(constraint.value)}
                        onChange={event => updateConstraint(selectedRule.id, index, { value: event.target.value === 'true' })}
                      >
                        <option value="true">Yes</option>
                        <option value="false">No</option>
                      </select>
                    ) : (
                      <input
                        disabled={!canEdit}
                        aria-label="Constraint value"
                        value={stringifyConstraintValue(constraint.value)}
                        onChange={event => updateConstraint(selectedRule.id, index, {
                          value: parseConstraintValue(event.target.value, constraint.operator),
                        })}
                        placeholder="100"
                      />
                    )}
                    <button
                      className="gate-icon-button"
                      disabled={!canEdit}
                      title="Remove argument limit"
                      aria-label="Remove argument limit"
                      onClick={() => updateRule(selectedRule.id, {
                        constraints: selectedRule.constraints.filter((_, position) => position !== index),
                      })}
                    >
                      <X size={15} />
                    </button>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <EmptyState icon={ListChecks} title="Select a rule" body="Rule details and typed argument limits appear here." />
          )}
        </aside>
      </div>
    );
  }

  function renderDecisions() {
    return (
      <div className="gate-workspace">
        <main className="gate-pane gate-pane-main">
          <div className="gate-page-heading">
            <div>
              <span className="gate-kicker">Runtime evidence</span>
              <h2>Action decisions</h2>
            </div>
            <div className="gate-heading-actions">
              <div className="gate-segmented gate-filter">
                {(['all', 'pending', 'blocked', 'allowed'] as DecisionFilter[]).map(filter => (
                  <button
                    key={filter}
                    className={decisionFilter === filter ? 'active' : ''}
                    onClick={() => setDecisionFilter(filter)}
                  >
                    {filter}
                  </button>
                ))}
              </div>
              {remoteEnabled && (
                <button
                  className="gate-icon-button"
                  title="Refresh decisions"
                  aria-label="Refresh decisions"
                  onClick={() => void refreshRemoteState(false)}
                >
                  <RefreshCw size={16} />
                </button>
              )}
            </div>
          </div>
          {!filteredEvents.length ? (
            <EmptyState
              icon={ShieldCheck}
              title={events.length ? 'No decisions match this filter' : 'No runtime decisions yet'}
              body={remoteEnabled
                ? 'Decision evidence appears after an agent calls the published gate.'
                : 'Run a local action preview from Connect. Local simulations stay separate from runtime evidence.'}
              action={(
                <button className="gate-button gate-button-secondary" onClick={() => setSection('connect')}>
                  <KeyRound size={16} /> Open Connect
                </button>
              )}
            />
          ) : (
            <div className="gate-table-wrap">
              <table className="gate-table gate-decision-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Agent</th>
                    <th>Tool</th>
                    <th>Operation</th>
                    <th>Decision</th>
                    <th>Review</th>
                    <th>Revision</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEvents.map(event => (
                    <tr
                      key={event.event_id}
                      className={event.event_id === selectedEventId ? 'selected' : ''}
                      onClick={() => setSelectedEventId(event.event_id)}
                    >
                      <td>{formatTime(event.created_at)}</td>
                      <td><strong>{event.agent_id || 'Agent'}</strong></td>
                      <td><code>{event.action?.tool || '-'}</code></td>
                      <td>{event.action?.operation || '-'}</td>
                      <td><span className={'gate-status ' + decisionClass(event.decision)}>{decisionLabel(event.decision)}</span></td>
                      <td><span className={'gate-status ' + (event.review_status === 'pending' ? 'approval' : 'neutral')}>{event.review_status.replace('_', ' ')}</span></td>
                      <td>{event.policy_revision || 'Draft'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </main>
        <aside className="gate-pane gate-inspector">
          {selectedEvent ? (
            <>
              <div className="gate-inspector-heading">
                <span className="gate-kicker">{selectedEvent.source === 'local_simulation' ? 'Local simulation' : 'Action packet'}</span>
                <h3>{selectedEvent.action?.tool || selectedEvent.agent_id || 'Decision event'}</h3>
              </div>
              <div className={'gate-decision-banner ' + decisionClass(selectedEvent.decision)}>
                {selectedEvent.decision === 'allow' ? <CheckCircle2 size={18} /> : selectedEvent.decision === 'deny' ? <Ban size={18} /> : <Clock3 size={18} />}
                <div>
                  <strong>{decisionLabel(selectedEvent.decision)}</strong>
                  <span>{selectedEvent.reason}</span>
                </div>
              </div>
              <dl className="gate-detail-list">
                <div><dt>Target</dt><dd><code>{selectedEvent.action?.target || '-'}</code></dd></div>
                <div><dt>Policy</dt><dd>Revision {selectedEvent.policy_revision || 'Draft'}</dd></div>
                <div><dt>Mode</dt><dd>{selectedEvent.mode}</dd></div>
                <div><dt>Rule</dt><dd>{selectedEvent.matched_rule_id || 'Default deny'}</dd></div>
                <div><dt>Review</dt><dd>{selectedEvent.review_status.replace('_', ' ')}</dd></div>
                <div><dt>Hash</dt><dd><code>{selectedEvent.action_hash.slice(0, 16)}...</code></dd></div>
              </dl>
              <div className="gate-inspector-section">
                <div className="gate-section-heading"><h4>Arguments</h4></div>
                <pre className="gate-code-block gate-code-small">{JSON.stringify(selectedEvent.action?.arguments || {}, null, 2)}</pre>
              </div>
              {selectedEvent.review_status === 'pending' && (
                <div className="gate-review-actions">
                  {remoteEnabled && canEdit ? (
                    <>
                      <button
                        className="gate-button gate-button-danger"
                        disabled={busy === 'decision-review'}
                        onClick={() => void reviewDecision('denied')}
                      >
                        <Ban size={16} /> Deny
                      </button>
                      <button
                        className="gate-button gate-button-primary"
                        disabled={busy === 'decision-review'}
                        onClick={() => void reviewDecision('approved')}
                      >
                        <Check size={16} /> Approve once
                      </button>
                    </>
                  ) : (
                    <div className="gate-system-band warning">
                      <Laptop size={17} />
                      <span>{remoteEnabled ? 'Member or admin access is required to review actions.' : 'Team approval requires a workspace server.'}</span>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <EmptyState icon={ShieldCheck} title="Select a decision" body="The exact action, policy reason, and review controls appear here." />
          )}
        </aside>
      </div>
    );
  }

  function renderRelease() {
    const publishedFingerprint = remoteEnabled
      ? authorityState?.published?.fingerprint
      : publishedPolicy ? 'local simulation snapshot' : null;
    return (
      <div className="gate-workspace">
        <main className="gate-pane gate-pane-main">
          <div className="gate-page-heading">
            <div>
              <span className="gate-kicker">Behavior change</span>
              <h2>Release review</h2>
            </div>
            <div className="gate-heading-actions">
              <button
                className="gate-button gate-button-secondary"
                onClick={() => downloadJson(
                  `fetchlab-${activeGateName.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'policy'}.json`,
                  { gate_id: activeStudyId, draft: policyDraft, published: publishedPolicy, diff: diffRows },
                )}
              >
                <Download size={16} /> Export
              </button>
              <button
                className="gate-button gate-button-primary"
                disabled={
                  busy === 'publish'
                  || dirty
                  || !policyDraft.rules.some(rule => rule.enabled)
                  || (remoteEnabled && (!canPublish || unresolvedExpansionCount > 0))
                }
                onClick={() => void (remoteEnabled ? publishPolicy() : snapshotLocalPolicy())}
              >
                {busy === 'publish' ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                {remoteEnabled ? 'Publish policy' : 'Save local revision'}
              </button>
            </div>
          </div>
          <div className="gate-release-strip">
            <div><span>Published</span><strong>{publishedRevision ? `Revision ${publishedRevision}` : 'None'}</strong></div>
            <div><span>Evidence</span><strong>{events.length}</strong></div>
            <div><span>Expansions</span><strong className={expansionCount ? 'warning' : ''}>{expansionCount}</strong></div>
            <div><span>Restrictions</span><strong>{restrictionCount}</strong></div>
          </div>
          {dirty && (
            <div className="gate-system-band warning">
              <AlertTriangle size={18} />
              <div>
                <strong>Unsaved draft</strong>
                <span>Save the draft before release review can be final.</span>
              </div>
              <button className="gate-button gate-button-secondary" onClick={() => void saveDraft()}>Save draft</button>
            </div>
          )}
          {!remoteEnabled && (
            <div className="gate-system-band warning">
              <Laptop size={18} />
              <div>
                <strong>Local revision only</strong>
                <span>This snapshot supports replay and export. It is not a shared policy, approval record, or runtime enforcement endpoint.</span>
              </div>
            </div>
          )}
          {!diffRows.length ? (
            <EmptyState
              icon={GitCompareArrows}
              title={events.length ? 'No decision changes' : 'No action evidence to replay'}
              body={events.length
                ? 'The draft makes the same decision as the published policy for every observed action.'
                : 'Connect an agent to collect runtime actions, or run a clearly labeled local simulation.'}
            />
          ) : (
            <div className="gate-table-wrap">
              <table className="gate-table gate-diff-table">
                <thead>
                  <tr>
                    <th>Action</th>
                    <th>Published</th>
                    <th>Draft</th>
                    <th>Change</th>
                    <th>Review</th>
                  </tr>
                </thead>
                <tbody>
                  {diffRows.map(row => {
                    const event = events.find(item => item.event_id === row.eventId);
                    return (
                      <tr
                        key={row.eventId}
                        className={row.eventId === selectedDiffEventId ? 'selected' : ''}
                        onClick={() => setSelectedDiffEventId(row.eventId)}
                      >
                        <td>
                          <strong>{event?.action?.tool || event?.agent_id || row.eventId.slice(0, 8)}</strong>
                          <span>{event?.action?.target || row.actionHash?.slice(0, 16)}</span>
                        </td>
                        <td><span className={'gate-status ' + decisionClass(row.previousDecision)}>{decisionLabel(row.previousDecision)}</span></td>
                        <td><span className={'gate-status ' + decisionClass(row.nextDecision)}>{decisionLabel(row.nextDecision)}</span></td>
                        <td><span className={'gate-status ' + (row.change === 'expansion' ? 'approval' : row.change === 'restriction' ? 'allow' : 'neutral')}>{row.change}</span></td>
                        <td>{row.review?.verdict || (row.change === 'expansion' ? 'Required' : '-')}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </main>
        <aside className="gate-pane gate-inspector">
          {selectedDiff ? (
            <>
              <div className="gate-inspector-heading">
                <span className="gate-kicker">Authority diff</span>
                <h3>{selectedDiffEvent?.action?.tool || selectedDiff.eventId.slice(0, 12)}</h3>
              </div>
              <div className="gate-decision-transition">
                <span className={'gate-status ' + decisionClass(selectedDiff.previousDecision)}>{decisionLabel(selectedDiff.previousDecision)}</span>
                <GitCompareArrows size={17} />
                <span className={'gate-status ' + decisionClass(selectedDiff.nextDecision)}>{decisionLabel(selectedDiff.nextDecision)}</span>
              </div>
              <dl className="gate-detail-list">
                <div><dt>Change</dt><dd>{selectedDiff.change}</dd></div>
                <div><dt>Published rule</dt><dd>{selectedDiff.previousRuleId || 'Default deny'}</dd></div>
                <div><dt>Draft rule</dt><dd>{selectedDiff.nextRuleId || 'Default deny'}</dd></div>
                <div><dt>Action hash</dt><dd><code>{selectedDiff.actionHash?.slice(0, 16) || '-'}...</code></dd></div>
                <div><dt>Review</dt><dd>{selectedDiff.review?.verdict || 'Not reviewed'}</dd></div>
              </dl>
              {selectedDiffEvent?.action && (
                <div className="gate-inspector-section">
                  <div className="gate-section-heading"><h4>Observed action</h4></div>
                  <pre className="gate-code-block gate-code-small">{JSON.stringify(selectedDiffEvent.action, null, 2)}</pre>
                </div>
              )}
              {selectedDiff.change === 'expansion' && remoteEnabled && canEdit && (
                <div className="gate-review-actions">
                  <button
                    className="gate-button gate-button-danger"
                    disabled={busy === 'expansion-review'}
                    onClick={() => void reviewExpansion('rejected')}
                  >
                    <Ban size={16} /> Reject
                  </button>
                  <button
                    className="gate-button gate-button-primary"
                    disabled={busy === 'expansion-review'}
                    onClick={() => void reviewExpansion('approved')}
                  >
                    <Check size={16} /> Approve change
                  </button>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="gate-inspector-heading">
                <span className="gate-kicker">Published policy</span>
                <h3>{publishedRevision ? `Revision ${publishedRevision}` : 'No revision'}</h3>
              </div>
              <dl className="gate-detail-list">
                <div><dt>Mode</dt><dd>{publishedPolicy?.mode || '-'}</dd></div>
                <div><dt>Rules</dt><dd>{publishedPolicy?.rules.length || 0}</dd></div>
                <div><dt>Fingerprint</dt><dd><code>{publishedFingerprint ? String(publishedFingerprint).slice(0, 16) + '...' : '-'}</code></dd></div>
                <div><dt>Unresolved</dt><dd>{unresolvedExpansionCount}</dd></div>
              </dl>
            </>
          )}
        </aside>
      </div>
    );
  }

  function renderActiveSection() {
    if (stateLoading) {
      return <div className="gate-loading"><Loader2 size={22} className="animate-spin" /> Loading gate state</div>;
    }
    if (section === 'connect') return renderConnect();
    if (section === 'rules') return renderRules();
    if (section === 'decisions') return renderDecisions();
    return renderRelease();
  }

  const studyOptions = remoteEnabled
    ? remoteStudies.map(study => ({ id: study.id, name: study.name }))
    : localGates.map(gate => ({ id: gate.id, name: gate.name }));

  return (
    <div className="agent-gate-shell" role="dialog" aria-modal="true" aria-label="Agent Change Gate">
      <header className="gate-topbar">
        <div className="gate-brand">
          <div className="gate-brand-mark"><ShieldCheck size={20} /></div>
          <div>
            <h1>Agent Change Gate</h1>
            <span>{remoteEnabled ? activeWorkspace?.name || 'Workspace' : 'Encrypted device simulation'}</span>
          </div>
        </div>
        <div className="gate-study-switcher">
          <select
            aria-label="Active action gate"
            value={activeStudyId}
            disabled={!studyOptions.length}
            onChange={event => {
              if (!confirmDiscardDraft()) return;
              setActiveStudyId(event.target.value);
              setCreatedCredential(null);
              setNotice('');
              setError('');
            }}
          >
            {!studyOptions.length && <option value="">No action gates</option>}
            {studyOptions.map(study => <option key={study.id} value={study.id}>{study.name}</option>)}
          </select>
          {canEdit && (
            <button className="gate-icon-button" title="Create action gate" aria-label="Create action gate" onClick={() => setShowCreate(true)}>
              <Plus size={17} />
            </button>
          )}
          {activeStudyId && canPublish && (
            <button
              className="gate-icon-button danger"
              title="Delete action gate"
              aria-label="Delete action gate"
              disabled={busy === 'delete'}
              onClick={() => void deleteGate()}
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
        <div className="gate-top-actions">
          <span className={'gate-runtime-state ' + (remoteEnabled ? 'connected' : 'local')}>
            {remoteEnabled ? <Server size={15} /> : <Laptop size={15} />}
            {remoteEnabled ? 'Workspace connected' : 'Local only'}
          </span>
          {activeStudyId && (
            <span className="gate-revision-state">
              {publishedRevision ? `Revision ${publishedRevision}` : 'Unpublished'}
            </span>
          )}
          <button className="gate-button gate-button-secondary" onClick={onOpenAdvanced}>
            <Code2 size={16} /> Advanced
          </button>
          <button className="gate-icon-button" title="Close Agent Change Gate" aria-label="Close Agent Change Gate" onClick={requestClose}>
            <X size={19} />
          </button>
        </div>
      </header>

      {notice && (
        <div className="gate-notice success" role="status">
          <CheckCircle2 size={16} />
          <span>{notice}</span>
          <button aria-label="Dismiss message" onClick={() => setNotice('')}><X size={14} /></button>
        </div>
      )}
      {error && (
        <div className="gate-notice error" role="alert">
          <AlertTriangle size={16} />
          <span>{error}</span>
          <button aria-label="Dismiss error" onClick={() => setError('')}><X size={14} /></button>
        </div>
      )}

      {inventoryLoading ? (
        <div className="gate-loading"><Loader2 size={22} className="animate-spin" /> Loading action gates</div>
      ) : !activeStudyId ? (
        <div className="gate-first-run">
          <EmptyState
            icon={ShieldCheck}
            title="Create the first action gate"
            body={remoteEnabled
              ? 'Define deterministic rules, connect an agent, review real action evidence, and publish a workspace policy.'
              : 'Build and replay a policy on this device. Local mode never claims team approval or runtime enforcement.'}
            action={canEdit ? (
              <button className="gate-button gate-button-primary" onClick={() => setShowCreate(true)}>
                <Plus size={16} /> Create action gate
              </button>
            ) : undefined}
          />
        </div>
      ) : (
        <div className="gate-body">
          <nav className="gate-sidebar" aria-label="Agent gate sections">
            <div className="gate-sidebar-nav">
              {SECTION_ITEMS.map(item => {
                const Icon = item.icon;
                const count = item.id === 'decisions' ? pendingCount : item.id === 'release' ? unresolvedExpansionCount : 0;
                return (
                  <button
                    key={item.id}
                    aria-label={item.label}
                    className={section === item.id ? 'active' : ''}
                    onClick={() => setSection(item.id)}
                  >
                    <Icon size={18} />
                    <span>{item.label}</span>
                    {count > 0 && <strong>{count}</strong>}
                  </button>
                );
              })}
            </div>
            <div className="gate-sidebar-status">
              <span className="gate-kicker">Current gate</span>
              <strong>{activeGateName}</strong>
              <dl>
                <div><dt>Mode</dt><dd>{policyDraft.mode}</dd></div>
                <div><dt>Rules</dt><dd>{policyDraft.rules.filter(rule => rule.enabled).length}</dd></div>
                <div><dt>Evidence</dt><dd>{events.length}</dd></div>
              </dl>
              {dirty && <span className="gate-dirty"><Clock3 size={14} /> Draft changed</span>}
            </div>
          </nav>
          {renderActiveSection()}
        </div>
      )}

      {showCreate && (
        <div className="gate-modal-backdrop" role="presentation" onMouseDown={() => setShowCreate(false)}>
          <div className="gate-modal" role="dialog" aria-modal="true" aria-labelledby="create-gate-title" onMouseDown={event => event.stopPropagation()}>
            <div className="gate-modal-heading">
              <div>
                <span className="gate-kicker">{remoteEnabled ? 'Workspace policy' : 'Device simulation'}</span>
                <h2 id="create-gate-title">Create action gate</h2>
              </div>
              <button className="gate-icon-button" title="Close" aria-label="Close" onClick={() => setShowCreate(false)}><X size={17} /></button>
            </div>
            <Field label="Gate name">
              <input
                autoFocus
                value={createName}
                onChange={event => setCreateName(event.target.value)}
                onKeyDown={event => {
                  if (event.key === 'Enter') void createGate();
                }}
                placeholder="Refund agent production gate"
              />
            </Field>
            <div className="gate-modal-actions">
              <button className="gate-button gate-button-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
              <button className="gate-button gate-button-primary" disabled={!createName.trim() || busy === 'create'} onClick={() => void createGate()}>
                {busy === 'create' ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                Create gate
              </button>
            </div>
          </div>
        </div>
      )}

      {showTokenForm && (
        <div className="gate-modal-backdrop" role="presentation" onMouseDown={() => setShowTokenForm(false)}>
          <div className="gate-modal" role="dialog" aria-modal="true" aria-labelledby="credential-title" onMouseDown={event => event.stopPropagation()}>
            <div className="gate-modal-heading">
              <div>
                <span className="gate-kicker">Runtime access</span>
                <h2 id="credential-title">Create credential</h2>
              </div>
              <button className="gate-icon-button" title="Close" aria-label="Close" onClick={() => setShowTokenForm(false)}><X size={17} /></button>
            </div>
            <Field label="Credential name">
              <input
                autoFocus
                value={tokenName}
                onChange={event => setTokenName(event.target.value)}
                placeholder={`${activeGateName || 'Agent gate'} runtime`}
              />
            </Field>
            <div className="gate-modal-actions">
              <button className="gate-button gate-button-secondary" onClick={() => setShowTokenForm(false)}>Cancel</button>
              <button className="gate-button gate-button-primary" disabled={busy === 'credential'} onClick={() => void createRuntimeCredential()}>
                {busy === 'credential' ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />}
                Create credential
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
