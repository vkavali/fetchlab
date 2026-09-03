import { lazy, Suspense, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  Circle,
  ExternalLink,
  FileCode2,
  FolderGit2,
  GitPullRequest,
  Loader2,
  MessageSquareText,
  Plus,
  RefreshCw,
  Server,
  ShieldCheck,
  Sparkles,
  Target,
  X,
  XCircle,
} from 'lucide-react';
import { useAuth } from '../auth/useAuth';
import {
  createLocalMission,
  loadLocalMissions,
  type MissionConfig,
  type MissionEvent,
  type MissionInput,
  type MissionStatus,
  type ProductMission,
} from '../product/missions';

const LLMSettings = lazy(() => import('./LLMSettings'));

interface Props {
  onSignIn?: () => void;
}

type ComposerKind = 'customer_issue' | 'regression' | 'ai_quality' | 'feature_request';

const EMPTY_INPUT: MissionInput = {
  title: '',
  outcome: '',
  evidence: '',
  repository: '',
  app_url: '',
  source_type: 'customer_issue',
};

const STARTERS: Array<{ id: ComposerKind; title: string; detail: string }> = [
  { id: 'customer_issue', title: 'Fix a customer issue', detail: 'Start from a support report, complaint, or failed workflow.' },
  { id: 'regression', title: 'Investigate a regression', detail: 'Connect a recent behavior change to the code that caused it.' },
  { id: 'ai_quality', title: 'Improve an AI failure', detail: 'Turn a bad production answer or agent action into a guarded change.' },
  { id: 'feature_request', title: 'Ship a repeated request', detail: 'Translate recurring evidence into a small reviewed implementation.' },
];

const STATUS_COPY: Record<MissionStatus, { label: string; tone: string; description: string }> = {
  draft: { label: 'Evidence captured', tone: 'text-cyan-300 bg-cyan-500/10 border-cyan-500/25', description: 'Ready for repository investigation.' },
  investigating: { label: 'Investigating', tone: 'text-blue-300 bg-blue-500/10 border-blue-500/25', description: 'Reading bounded repository context.' },
  needs_input: { label: 'Needs evidence', tone: 'text-amber-300 bg-amber-500/10 border-amber-500/25', description: 'The system refused to invent a change.' },
  proposed: { label: 'Review proposal', tone: 'text-violet-300 bg-violet-500/10 border-violet-500/25', description: 'Exact source changes are ready for approval.' },
  approving: { label: 'Opening draft PR', tone: 'text-blue-300 bg-blue-500/10 border-blue-500/25', description: 'The approved proposal is being written to an isolated branch.' },
  awaiting_validation: { label: 'Checks pending', tone: 'text-blue-300 bg-blue-500/10 border-blue-500/25', description: 'A draft pull request exists. Repository checks decide readiness.' },
  ready_for_review: { label: 'Checks passed', tone: 'text-green-300 bg-green-500/10 border-green-500/25', description: 'Reported repository checks completed successfully.' },
  validation_failed: { label: 'Checks failed', tone: 'text-red-300 bg-red-500/10 border-red-500/25', description: 'The pull request is not ready for review.' },
  failed: { label: 'Blocked', tone: 'text-red-300 bg-red-500/10 border-red-500/25', description: 'Investigation stopped without fabricating a result.' },
  rejected: { label: 'Rejected', tone: 'text-gray-300 bg-gray-500/10 border-gray-500/25', description: 'The proposal was not approved.' },
};

const EVENT_LABELS: Record<string, string> = {
  'mission.captured': 'Customer evidence captured',
  'mission.updated': 'Mission evidence updated',
  'investigation.started': 'Repository investigation started',
  'investigation.needs_input': 'Investigation requested more evidence',
  'investigation.failed': 'Investigation stopped',
  'proposal.prepared': 'Exact code proposal prepared',
  'pull_request.opened': 'Draft pull request opened',
  'validation.unverified': 'No repository checks were found',
  'validation.pending': 'Repository checks are running',
  'validation.failed': 'Repository checks failed',
  'validation.passed': 'Repository checks passed',
  'mission.rejected': 'Mission rejected',
};

function timeAgo(value?: string) {
  if (!value) return '';
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return '';
  const seconds = Math.max(0, Math.floor((Date.now() - time) / 1000));
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function missionProgress(mission: ProductMission) {
  const stages = [
    { label: 'Evidence', done: true, active: mission.status === 'draft' || mission.status === 'needs_input' || mission.status === 'failed' },
    { label: 'Proposal', done: !!mission.data.proposal, active: mission.status === 'investigating' || mission.status === 'proposed' },
    { label: 'Draft PR', done: !!mission.data.pull_request, active: mission.status === 'approving' || mission.status === 'awaiting_validation' },
    { label: 'Checks', done: mission.status === 'ready_for_review', active: mission.status === 'validation_failed' },
  ];
  return stages;
}

async function readJson<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data as T;
}

function StatusPill({ status }: { status: MissionStatus }) {
  const copy = STATUS_COPY[status] || STATUS_COPY.draft;
  return <span className={`inline-flex items-center border rounded px-2.5 py-1 text-xs font-semibold ${copy.tone}`}>{copy.label}</span>;
}

function ConfigSignal({ ok, icon, label, detail }: { ok: boolean; icon: ReactNode; label: string; detail: string }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-gray-800 last:border-b-0">
      <div className={`mt-0.5 ${ok ? 'text-green-400' : 'text-amber-400'}`}>{icon}</div>
      <div className="min-w-0">
        <div className="text-sm font-semibold text-gray-100">{label}</div>
        <div className="text-sm leading-6 text-gray-400">{detail}</div>
      </div>
    </div>
  );
}

export default function MissionWorkspace({ onSignIn }: Props) {
  const { user, workspaces, serverEnabled, activeWorkspaceId, authFetch } = useAuth();
  const remote = !!(user && serverEnabled && activeWorkspaceId);
  const activeWorkspace = workspaces.find(workspace => workspace.id === activeWorkspaceId);
  const canManageWorkspace = !!(user && activeWorkspace && (
    activeWorkspace.owner_id === user.id || activeWorkspace.member_role === 'admin'
  ));
  const [missions, setMissions] = useState<ProductMission[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [events, setEvents] = useState<MissionEvent[]>([]);
  const [config, setConfig] = useState<MissionConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [composing, setComposing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingVersion, setEditingVersion] = useState<string | null>(null);
  const [kind, setKind] = useState<ComposerKind>('customer_issue');
  const [form, setForm] = useState<MissionInput>(EMPTY_INPUT);
  const [expandedFile, setExpandedFile] = useState<string | null>(null);
  const [showGithubSetup, setShowGithubSetup] = useState(false);
  const [showLlmSettings, setShowLlmSettings] = useState(false);
  const [githubError, setGithubError] = useState('');
  const [githubForm, setGithubForm] = useState({ token: '', repository: '' });

  const selected = useMemo(
    () => missions.find(mission => mission.id === selectedId) || null,
    [missions, selectedId],
  );

  const replaceMission = useCallback((mission: ProductMission) => {
    setMissions(current => [mission, ...current.filter(item => item.id !== mission.id)]);
    setSelectedId(mission.id);
  }, []);

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (remote && activeWorkspaceId) {
        const [missionResult, configResult] = await Promise.all([
          authFetch(`/api/workspaces/${encodeURIComponent(activeWorkspaceId)}/missions`).then(readJson<{ missions: ProductMission[] }>),
          authFetch(`/api/workspaces/${encodeURIComponent(activeWorkspaceId)}/missions/config`).then(readJson<MissionConfig>),
        ]);
        setMissions(missionResult.missions);
        setConfig(configResult);
        setGithubForm(current => ({
          ...current,
          repository: current.repository || configResult.github.default_repository || '',
        }));
        setSelectedId(current => current && missionResult.missions.some(item => item.id === current) ? current : missionResult.missions[0]?.id || null);
        if (configResult.github.default_repository) {
          setForm(current => current.repository
            ? current
            : { ...current, repository: configResult.github.default_repository });
        }
      } else {
        const local = await loadLocalMissions();
        setMissions(local);
        setConfig(null);
        setSelectedId(current => current && local.some(item => item.id === current) ? current : local[0]?.id || null);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load product missions');
    } finally {
      setLoading(false);
    }
  }, [activeWorkspaceId, authFetch, remote]);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  useEffect(() => {
    if (!remote || !activeWorkspaceId || !selectedId || composing) {
      setEvents(selectedId ? [{
        id: `local-${selectedId}`,
        mission_id: selectedId,
        workspace_id: 'local',
        event_type: 'mission.captured',
        created_at: selected?.created_at || new Date().toISOString(),
      }] : []);
      return;
    }
    let cancelled = false;
    void authFetch(`/api/workspaces/${encodeURIComponent(activeWorkspaceId)}/missions/${encodeURIComponent(selectedId)}`)
      .then(readJson<{ mission: ProductMission; events: MissionEvent[] }>)
      .then(result => {
        if (cancelled) return;
        replaceMission(result.mission);
        setEvents(result.events || []);
      })
      .catch(loadError => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Could not load mission');
      });
    return () => { cancelled = true; };
  }, [activeWorkspaceId, authFetch, composing, remote, replaceMission, selected?.created_at, selectedId]);

  const resetComposer = (input: MissionInput = EMPTY_INPUT) => {
    setForm({
      ...input,
      repository: input.repository || config?.github.default_repository || '',
    });
    setKind((input.source_type as ComposerKind) || 'customer_issue');
    setEditingId(null);
    setEditingVersion(null);
    setComposing(true);
    setError('');
    setNotice('');
  };

  const editMission = () => {
    if (!selected) return;
    setEditingId(selected.id);
    setEditingVersion(selected.updated_at);
    setKind((selected.data.input.source_type as ComposerKind) || 'customer_issue');
    setForm(selected.data.input);
    setComposing(true);
    setError('');
  };

  const runAction = async (missionId: string, action: string, body?: unknown) => {
    if (!remote || !activeWorkspaceId) throw new Error('Sign in to run repository actions');
    const result = await authFetch(
      `/api/workspaces/${encodeURIComponent(activeWorkspaceId)}/missions/${encodeURIComponent(missionId)}/${action}`,
      { method: 'POST', body: body ? JSON.stringify(body) : undefined },
    ).then(readJson<{ mission: ProductMission; events: MissionEvent[] }>);
    replaceMission(result.mission);
    setEvents(result.events || []);
    return result.mission;
  };

  const submitMission = async () => {
    setError('');
    setNotice('');
    if (form.title.trim().length < 3) return setError('Give the mission a specific title.');
    if (form.outcome.trim().length < 8) return setError('Describe the result the user should experience.');
    if (form.evidence.trim().length < 20) return setError('Add the real report, expected behavior, and what happened instead.');
    setBusy('create');
    try {
      const input = { ...form, source_type: kind };
      if (!remote || !activeWorkspaceId) {
        const mission = await createLocalMission(input);
        replaceMission(mission);
        setEvents([{
          id: `local-${mission.id}`,
          mission_id: mission.id,
          workspace_id: 'local',
          event_type: 'mission.captured',
          created_at: mission.created_at,
        }]);
        setComposing(false);
        setNotice('Mission encrypted and saved on this device. Sign in to investigate the repository.');
        return;
      }

      const path = editingId
        ? `/api/workspaces/${encodeURIComponent(activeWorkspaceId)}/missions/${encodeURIComponent(editingId)}`
        : `/api/workspaces/${encodeURIComponent(activeWorkspaceId)}/missions`;
      const result = await authFetch(path, {
        method: editingId ? 'PUT' : 'POST',
        body: JSON.stringify(editingId ? { ...input, expected_updated_at: editingVersion } : input),
      }).then(readJson<{ mission: ProductMission; events: MissionEvent[] }>);
      replaceMission(result.mission);
      setEvents(result.events || []);
      setComposing(false);
      setEditingId(null);
      setEditingVersion(null);

      const canInvestigate = !!(config?.ai.configured && config.github.configured && input.repository);
      if (canInvestigate) {
        setBusy('investigate');
        try {
          await runAction(result.mission.id, 'investigate');
          setNotice('Investigation completed. Review the exact proposal before approving a draft pull request.');
        } catch (investigationError) {
          await loadWorkspace();
          throw investigationError;
        }
      } else {
        setNotice('Mission saved. Connect GitHub and an AI provider to investigate it.');
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Could not save mission');
    } finally {
      setBusy(null);
    }
  };

  const investigateSelected = async () => {
    if (!selected) return;
    setBusy('investigate');
    setError('');
    setNotice('');
    try {
      await runAction(selected.id, 'investigate');
      setNotice('Investigation completed. The proposal is waiting for human review.');
    } catch (actionError) {
      await loadWorkspace();
      setError(actionError instanceof Error ? actionError.message : 'Investigation failed');
    } finally {
      setBusy(null);
    }
  };

  const approveSelected = async () => {
    if (!selected?.proposal_hash) return;
    setBusy('approve');
    setError('');
    try {
      await runAction(selected.id, 'approve', { proposal_hash: selected.proposal_hash });
      setNotice('Draft pull request created from the exact proposal you reviewed.');
    } catch (actionError) {
      await loadWorkspace();
      setError(actionError instanceof Error ? actionError.message : 'Could not create draft pull request');
    } finally {
      setBusy(null);
    }
  };

  const refreshValidation = async () => {
    if (!selected) return;
    setBusy('validation');
    setError('');
    try {
      const mission = await runAction(selected.id, 'validation');
      setNotice(mission.data.validation?.verified
        ? 'Repository checks passed. The draft pull request is ready for human review.'
        : mission.data.validation?.state === 'unverified'
          ? 'No repository checks were found. FetchLab will not call this change verified.'
          : 'Repository validation status refreshed.');
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Could not refresh checks');
    } finally {
      setBusy(null);
    }
  };

  const rejectSelected = async () => {
    if (!selected || !window.confirm('Reject this proposal? No repository change will be created.')) return;
    setBusy('reject');
    setError('');
    try {
      await runAction(selected.id, 'reject', { reason: 'Rejected during proposal review' });
      setNotice('Proposal rejected. No repository change was created.');
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Could not reject proposal');
    } finally {
      setBusy(null);
    }
  };

  const connectGithub = async () => {
    if (!remote || !activeWorkspaceId) return;
    setBusy('github');
    setGithubError('');
    setNotice('');
    try {
      const result = await authFetch(
        `/api/workspaces/${encodeURIComponent(activeWorkspaceId)}/missions/config/github`,
        {
          method: 'PUT',
          body: JSON.stringify({
            token: githubForm.token,
            repository: githubForm.repository,
          }),
        },
      ).then(readJson<{ github: MissionConfig['github'] }>);
      setConfig(current => current ? { ...current, github: result.github } : current);
      setForm(current => current.repository
        ? current
        : { ...current, repository: result.github.default_repository });
      setGithubForm(current => ({ ...current, token: '', repository: result.github.default_repository }));
      setShowGithubSetup(false);
      setNotice('GitHub access verified and encrypted for this workspace.');
    } catch (connectError) {
      setGithubError(connectError instanceof Error ? connectError.message : 'Could not connect GitHub');
    } finally {
      setBusy(null);
    }
  };

  const canInvestigateStatus = !!selected && ['draft', 'needs_input', 'failed', 'proposed'].includes(selected.status);
  const investigationReady = !!(remote && config?.github.configured && config.ai.configured && selected?.data.input.repository && canInvestigateStatus);
  const createWillInvestigate = !!(remote && config?.github.configured && config.ai.configured && form.repository);

  return (
    <>
    <main className="flex-1 min-h-0 overflow-y-auto lg:overflow-hidden bg-gray-950 text-gray-100">
      <div className="min-h-full lg:h-full grid grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)_340px]">
        <aside className="max-h-72 lg:max-h-none lg:min-h-0 border-b lg:border-b-0 lg:border-r border-gray-800 bg-gray-950 flex flex-col">
          <div className="h-16 px-5 flex items-center justify-between border-b border-gray-800">
            <div>
              <div className="text-base font-semibold">Product missions</div>
              <div className="text-xs text-gray-500">Evidence to reviewed change</div>
            </div>
            <button
              type="button"
              onClick={() => resetComposer()}
              className="h-9 w-9 inline-flex items-center justify-center rounded-md bg-cyan-400 text-gray-950 hover:bg-cyan-300"
              title="New product mission"
              aria-label="New product mission"
            >
              <Plus size={18} />
            </button>
          </div>

          {!remote && (
            <div className="mx-4 mt-4 border border-amber-500/30 bg-amber-500/10 rounded-md p-3">
              <div className="text-sm font-semibold text-amber-200">Local draft mode</div>
              <p className="mt-1 text-xs leading-5 text-amber-100/70">Missions are encrypted on this device. Repository work requires a signed-in workspace.</p>
              {onSignIn && (
                <button type="button" onClick={onSignIn} className="mt-3 text-sm font-semibold text-amber-100 hover:text-white">
                  Sign in to execute <ArrowRight size={14} className="inline ml-1" />
                </button>
              )}
            </div>
          )}

          <div className="flex-1 min-h-0 overflow-y-auto p-3">
            {loading ? (
              <div className="h-28 flex items-center justify-center text-sm text-gray-500"><Loader2 size={18} className="animate-spin mr-2" /> Loading missions</div>
            ) : missions.length === 0 ? (
              <div className="p-4 text-sm leading-6 text-gray-500">No fake examples. Your first real customer problem will appear here.</div>
            ) : missions.map(mission => (
              <button
                key={mission.id}
                type="button"
                onClick={() => { setSelectedId(mission.id); setComposing(false); setError(''); }}
                className={`w-full text-left p-3 mb-2 border rounded-md transition-colors ${selectedId === mission.id && !composing ? 'border-cyan-400/50 bg-cyan-400/10' : 'border-gray-800 bg-gray-900/40 hover:border-gray-700 hover:bg-gray-900'}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="text-sm font-semibold leading-5 text-gray-100 line-clamp-2">{mission.title}</span>
                  {mission.status === 'ready_for_review' && <CheckCircle2 size={15} className="text-green-400 flex-none mt-0.5" />}
                  {mission.status === 'validation_failed' && <XCircle size={15} className="text-red-400 flex-none mt-0.5" />}
                </div>
                <div className="mt-2 flex items-center justify-between gap-2 text-xs text-gray-500">
                  <span>{STATUS_COPY[mission.status]?.label}</span>
                  <span>{timeAgo(mission.updated_at)}</span>
                </div>
              </button>
            ))}
          </div>
        </aside>

        {composing || (!selected && !loading) ? (
          <section className="lg:col-span-2 lg:min-h-0 lg:overflow-y-auto">
            <div className="max-w-4xl mx-auto px-6 py-10 md:px-10 md:py-14">
              <div className="flex items-start justify-between gap-6">
                <div>
                  <div className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-300"><Target size={17} /> New product mission</div>
                  <h1 className="mt-3 text-3xl md:text-4xl font-semibold leading-tight">What product outcome should FetchLab own?</h1>
                  <p className="mt-3 max-w-2xl text-base leading-7 text-gray-400">Start with evidence from a real user. FetchLab will investigate the repository and prepare an exact change, but nothing reaches GitHub until you approve it.</p>
                </div>
                {missions.length > 0 && composing && (
                  <button type="button" onClick={() => setComposing(false)} className="h-10 w-10 flex-none inline-flex items-center justify-center rounded-md border border-gray-700 hover:bg-gray-900" title="Close composer" aria-label="Close composer"><X size={18} /></button>
                )}
              </div>

              <div className="mt-8 grid sm:grid-cols-2 gap-3" role="radiogroup" aria-label="Mission type">
                {STARTERS.map(starter => (
                  <button
                    key={starter.id}
                    type="button"
                    role="radio"
                    aria-checked={kind === starter.id}
                    onClick={() => { setKind(starter.id); setForm(current => ({ ...current, source_type: starter.id })); }}
                    className={`text-left border rounded-md p-4 ${kind === starter.id ? 'border-cyan-400 bg-cyan-400/10' : 'border-gray-800 bg-gray-900/50 hover:border-gray-700'}`}
                  >
                    <div className="text-base font-semibold text-gray-100">{starter.title}</div>
                    <div className="mt-1 text-sm leading-6 text-gray-400">{starter.detail}</div>
                  </button>
                ))}
              </div>

              <div className="mt-8 space-y-6">
                <label className="block">
                  <span className="block text-sm font-semibold text-gray-200 mb-2">Mission title</span>
                  <input
                    value={form.title}
                    onChange={event => setForm(current => ({ ...current, title: event.target.value }))}
                    placeholder="Example: Checkout total becomes NaN after a discount"
                    maxLength={120}
                    className="w-full h-12 px-4 rounded-md border border-gray-700 bg-gray-900 text-base text-gray-100 placeholder:text-gray-600 focus:outline-none focus:border-cyan-400"
                  />
                </label>
                <label className="block">
                  <span className="block text-sm font-semibold text-gray-200 mb-2">Real customer evidence</span>
                  <textarea
                    value={form.evidence}
                    onChange={event => setForm(current => ({ ...current, evidence: event.target.value }))}
                    placeholder="Paste the support report, failing output, expected behavior, what happened instead, and any reproduction details."
                    maxLength={30_000}
                    className="w-full min-h-52 resize-y px-4 py-3 rounded-md border border-gray-700 bg-gray-900 text-base leading-7 text-gray-100 placeholder:text-gray-600 focus:outline-none focus:border-cyan-400"
                  />
                </label>
                <label className="block">
                  <span className="block text-sm font-semibold text-gray-200 mb-2">Desired outcome</span>
                  <textarea
                    value={form.outcome}
                    onChange={event => setForm(current => ({ ...current, outcome: event.target.value }))}
                    placeholder="Describe what the user should be able to do after the change."
                    maxLength={1_000}
                    className="w-full min-h-28 resize-y px-4 py-3 rounded-md border border-gray-700 bg-gray-900 text-base leading-7 text-gray-100 placeholder:text-gray-600 focus:outline-none focus:border-cyan-400"
                  />
                </label>
                <div className="grid md:grid-cols-2 gap-5">
                  <label className="block">
                    <span className="block text-sm font-semibold text-gray-200 mb-2">GitHub repository</span>
                    <div className="relative">
                      <FolderGit2 size={17} className="absolute left-3.5 top-3.5 text-gray-500" />
                      <input
                        value={form.repository}
                        onChange={event => setForm(current => ({ ...current, repository: event.target.value }))}
                        placeholder="owner/repository"
                        className="w-full h-12 pl-11 pr-4 rounded-md border border-gray-700 bg-gray-900 text-base text-gray-100 placeholder:text-gray-600 focus:outline-none focus:border-cyan-400"
                      />
                    </div>
                  </label>
                  <label className="block">
                    <span className="block text-sm font-semibold text-gray-200 mb-2">Live or staging URL <span className="font-normal text-gray-500">optional</span></span>
                    <div className="relative">
                      <Server size={17} className="absolute left-3.5 top-3.5 text-gray-500" />
                      <input
                        value={form.app_url}
                        onChange={event => setForm(current => ({ ...current, app_url: event.target.value }))}
                        placeholder="https://staging.example.com/path"
                        className="w-full h-12 pl-11 pr-4 rounded-md border border-gray-700 bg-gray-900 text-base text-gray-100 placeholder:text-gray-600 focus:outline-none focus:border-cyan-400"
                      />
                    </div>
                  </label>
                </div>
              </div>

              {error && <div role="alert" className="mt-6 flex items-start gap-3 rounded-md border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200"><AlertTriangle size={18} className="flex-none" /> {error}</div>}

              <div className="mt-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-gray-800 pt-6">
                <p className="text-sm leading-6 text-gray-500">During investigation, selected repository files are sent to your configured AI provider. Evidence and proposed source are encrypted at rest. FetchLab creates draft pull requests only.</p>
                <button
                  type="button"
                  onClick={() => void submitMission()}
                  disabled={!!busy}
                  className="h-12 px-6 inline-flex items-center justify-center gap-2 rounded-md bg-cyan-400 text-gray-950 text-sm font-bold hover:bg-cyan-300 disabled:opacity-50"
                >
                  {busy ? <Loader2 size={18} className="animate-spin" /> : createWillInvestigate ? <Sparkles size={18} /> : <Check size={18} />}
                  {editingId ? (createWillInvestigate ? 'Update and investigate' : 'Update mission') : (createWillInvestigate ? 'Create and investigate' : 'Save mission')}
                </button>
              </div>
            </div>
          </section>
        ) : selected ? (
          <>
            <section className="lg:min-h-0 lg:overflow-y-auto lg:border-r border-gray-800">
              <div className="max-w-4xl mx-auto px-6 py-8 md:px-8 md:py-10">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <StatusPill status={selected.status} />
                    <h1 className="mt-4 text-2xl md:text-3xl font-semibold leading-tight text-gray-50">{selected.title}</h1>
                    <p className="mt-3 text-base leading-7 text-gray-300">{selected.data.input.outcome}</p>
                  </div>
                  {!selected.data.pull_request && ['draft', 'needs_input', 'failed', 'proposed'].includes(selected.status) && (
                    <button type="button" onClick={editMission} className="h-10 px-4 rounded-md border border-gray-700 text-sm font-semibold text-gray-200 hover:bg-gray-900">Edit evidence</button>
                  )}
                </div>

                <div className="mt-8 grid grid-cols-4 border-y border-gray-800 py-5">
                  {missionProgress(selected).map((stage, index) => (
                    <div key={stage.label} className="relative flex flex-col items-center gap-2 text-center px-1">
                      {index < 3 && <span className={`absolute top-2.5 left-1/2 w-full h-px ${stage.done ? 'bg-green-500/50' : 'bg-gray-800'}`} />}
                      <span className={`relative z-10 h-5 w-5 rounded-full inline-flex items-center justify-center border ${stage.done ? 'bg-green-500 border-green-400 text-gray-950' : stage.active ? 'bg-cyan-400 border-cyan-300 text-gray-950' : 'bg-gray-950 border-gray-700 text-gray-600'}`}>
                        {stage.done ? <Check size={12} strokeWidth={3} /> : <Circle size={8} fill="currentColor" />}
                      </span>
                      <span className={`text-xs font-semibold ${stage.done || stage.active ? 'text-gray-200' : 'text-gray-600'}`}>{stage.label}</span>
                    </div>
                  ))}
                </div>

                {error && <div role="alert" className="mt-6 flex items-start gap-3 rounded-md border border-red-500/30 bg-red-500/10 p-4 text-sm leading-6 text-red-200"><AlertTriangle size={18} className="flex-none mt-0.5" /> {error}</div>}
                {notice && <div role="status" className="mt-6 flex items-start gap-3 rounded-md border border-cyan-500/30 bg-cyan-500/10 p-4 text-sm leading-6 text-cyan-100"><CheckCircle2 size={18} className="flex-none mt-0.5" /> {notice}</div>}

                <section className="mt-8">
                  <div className="flex items-center gap-2 text-sm font-semibold text-gray-300"><MessageSquareText size={17} /> Customer evidence</div>
                  <div className="mt-3 border-l-2 border-cyan-400 pl-5 text-base leading-8 text-gray-200 whitespace-pre-wrap break-words">{selected.data.input.evidence}</div>
                  <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-gray-500">
                    <span>Source: {selected.data.input.source_type.replace(/_/g, ' ')}</span>
                    <span>Repository: {selected.data.input.repository || 'Not connected'}</span>
                    {selected.data.input.app_url && <span className="truncate max-w-full">Environment: {selected.data.input.app_url}</span>}
                  </div>
                </section>

                {selected.data.investigation?.questions && selected.data.investigation.questions.length > 0 && (
                  <section className="mt-8 rounded-md border border-amber-500/30 bg-amber-500/10 p-5">
                    <div className="flex items-center gap-2 text-base font-semibold text-amber-100"><AlertTriangle size={18} /> More evidence required</div>
                    <ul className="mt-3 space-y-2 text-sm leading-6 text-amber-50/80">
                      {selected.data.investigation.questions.map(question => (
                        <li key={question} className="flex gap-2">
                          <span aria-hidden="true">-</span>
                          <span>{question}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                {selected.data.last_error && (
                  <section className="mt-8 rounded-md border border-red-500/30 bg-red-500/10 p-5">
                    <div className="flex items-center gap-2 text-base font-semibold text-red-100"><XCircle size={18} /> Action stopped</div>
                    <p className="mt-2 text-sm leading-6 text-red-100/80">{selected.data.last_error.message}</p>
                  </section>
                )}

                {selected.data.investigation?.availability && (
                  <section className="mt-8 border border-gray-800 rounded-md p-5 bg-gray-900/40">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2 text-base font-semibold"><Server size={18} /> Environment availability</div>
                      <span className={`text-sm font-semibold ${selected.data.investigation.availability.reachable ? 'text-green-400' : 'text-red-400'}`}>
                        {selected.data.investigation.availability.status || selected.data.investigation.availability.status_text}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-gray-400">{selected.data.investigation.availability.claim}</p>
                  </section>
                )}

                {selected.data.proposal ? (
                  <section className="mt-10">
                    <div className="flex items-center gap-2 text-sm font-semibold text-violet-300"><FileCode2 size={18} /> Proposed product change</div>
                    <h2 className="mt-3 text-2xl font-semibold leading-8">{selected.data.proposal.summary}</h2>
                    <p className="mt-3 text-base leading-7 text-gray-300">{selected.data.proposal.user_impact}</p>

                    <div className="mt-7 grid md:grid-cols-2 gap-6">
                      <div>
                        <h3 className="text-sm font-semibold text-gray-200">Likely cause</h3>
                        <p className="mt-2 text-sm leading-6 text-gray-400">{selected.data.proposal.root_cause}</p>
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-gray-200">Acceptance criteria</h3>
                        <ul className="mt-2 space-y-2 text-sm leading-6 text-gray-300">
                          {selected.data.proposal.acceptance_criteria.map(item => <li key={item} className="flex gap-2"><CheckCircle2 size={16} className="text-green-400 flex-none mt-1" /> <span>{item}</span></li>)}
                        </ul>
                      </div>
                    </div>

                    <div className="mt-8 border-y border-gray-800">
                      {selected.data.proposal.files.map(file => (
                        <div key={file.path} className="border-b border-gray-800 last:border-b-0">
                          <button
                            type="button"
                            onClick={() => setExpandedFile(current => current === file.path ? null : file.path)}
                            className="w-full min-h-16 py-3 flex items-center justify-between gap-4 text-left hover:bg-gray-900/60"
                          >
                            <div className="min-w-0">
                              <div className="font-mono text-sm text-cyan-200 truncate">{file.path}</div>
                              <div className="mt-1 text-sm text-gray-400">{file.explanation}</div>
                            </div>
                            <span className="text-sm font-semibold text-cyan-300 flex-none">{expandedFile === file.path ? 'Hide source' : 'Review source'}</span>
                          </button>
                          {expandedFile === file.path && (
                            <pre className="max-h-[520px] overflow-auto border-t border-gray-800 bg-black/40 p-5 text-[13px] leading-6 text-gray-200 whitespace-pre"><code>{file.content}</code></pre>
                          )}
                        </div>
                      ))}
                    </div>

                    {(selected.data.proposal.risks.length > 0 || selected.data.proposal.manual_review.length > 0) && (
                      <div className="mt-7 grid md:grid-cols-2 gap-6">
                        <div>
                          <h3 className="text-sm font-semibold text-amber-200">Risks</h3>
                          <ul className="mt-2 space-y-2 text-sm leading-6 text-gray-400">{selected.data.proposal.risks.map(item => (
                            <li key={item} className="flex gap-2"><span aria-hidden="true">-</span><span>{item}</span></li>
                          ))}</ul>
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-gray-200">Human review</h3>
                          <ul className="mt-2 space-y-2 text-sm leading-6 text-gray-400">{selected.data.proposal.manual_review.map(item => (
                            <li key={item} className="flex gap-2"><span aria-hidden="true">-</span><span>{item}</span></li>
                          ))}</ul>
                        </div>
                      </div>
                    )}
                  </section>
                ) : (
                  selected.status !== 'rejected' && (
                    <section className="mt-10 border-t border-gray-800 pt-8">
                      <h2 className="text-xl font-semibold">Prepare the first evidence-backed change</h2>
                      <p className="mt-2 text-sm leading-6 text-gray-400">FetchLab will read a bounded set of repository files. It will stop and ask questions when the evidence cannot support a responsible change.</p>
                      <button
                        type="button"
                        onClick={() => void investigateSelected()}
                        disabled={!investigationReady || !!busy}
                        className="mt-5 h-11 px-5 inline-flex items-center gap-2 rounded-md bg-cyan-400 text-gray-950 text-sm font-bold hover:bg-cyan-300 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {busy === 'investigate' || selected.status === 'investigating' ? <Loader2 size={17} className="animate-spin" /> : <Sparkles size={17} />}
                        {selected.status === 'investigating' ? 'Investigation in progress' : 'Investigate repository'}
                      </button>
                      {!investigationReady && remote && (
                        <p className="mt-3 text-sm text-amber-300">Connect {config?.github.configured ? '' : 'GitHub'}{!config?.github.configured && !config?.ai.configured ? ' and ' : ''}{config?.ai.configured ? '' : 'an AI provider'} before investigating.</p>
                      )}
                    </section>
                  )
                )}

                <section className="mt-12 border-t border-gray-800 pt-8 pb-10">
                  <h2 className="text-base font-semibold">Mission record</h2>
                  <div className="mt-4 space-y-0">
                    {events.map((event, index) => (
                      <div key={event.id} className="relative flex gap-4 pb-5 last:pb-0">
                        {index < events.length - 1 && <span className="absolute left-[7px] top-4 bottom-0 w-px bg-gray-800" />}
                        <span className="relative z-10 mt-1 h-4 w-4 rounded-full border border-gray-700 bg-gray-950 flex-none" />
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-gray-300">{EVENT_LABELS[event.event_type] || event.event_type.replace(/[._]/g, ' ')}</div>
                          <div className="mt-0.5 text-xs text-gray-600">{new Date(event.created_at).toLocaleString()}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            </section>

            <aside className="lg:min-h-0 lg:overflow-y-auto border-t lg:border-t-0 border-gray-800 bg-gray-950 p-5">
              <div className="flex items-center gap-2 text-base font-semibold"><ShieldCheck size={18} className="text-cyan-300" /> Release decision</div>
              <p className="mt-2 text-sm leading-6 text-gray-400">{STATUS_COPY[selected.status]?.description}</p>

              <div className="mt-5 border-y border-gray-800">
                <ConfigSignal
                  ok={remote ? !!config?.github.configured : false}
                  icon={<FolderGit2 size={17} />}
                  label="Repository access"
                  detail={remote
                    ? (config?.github.configured
                      ? `${selected.data.input.repository || config.github.default_repository} via ${config.github.source || 'server'} credential`
                      : 'No GitHub repository is connected to this workspace.')
                    : 'Requires a signed-in server workspace.'}
                />
                <ConfigSignal
                  ok={remote ? !!config?.ai.configured : false}
                  icon={<Sparkles size={17} />}
                  label="Investigation model"
                  detail={remote ? (config?.ai.configured ? `${config.ai.provider} via ${config.ai.source || 'server'}` : 'Configure an external provider. Local heuristics cannot write code.') : 'Requires a signed-in server workspace.'}
                />
              </div>

              {remote && (
                <div className="mt-5 space-y-3">
                  {canManageWorkspace && (
                    <button
                      type="button"
                      onClick={() => {
                        setGithubError('');
                        setGithubForm(current => ({
                          ...current,
                          repository: current.repository || config?.github.default_repository || '',
                        }));
                        setShowGithubSetup(current => !current);
                      }}
                      className="w-full h-10 px-4 rounded-md border border-gray-700 text-sm font-semibold text-gray-200 hover:bg-gray-900"
                    >
                      {config?.github.source === 'workspace' ? 'Update GitHub connection' : 'Connect GitHub repository'}
                    </button>
                  )}
                  {!canManageWorkspace && !config?.github.configured && (
                    <p className="text-sm leading-6 text-amber-300">A workspace admin must connect GitHub.</p>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowLlmSettings(true)}
                    className="w-full h-10 px-4 rounded-md border border-gray-700 text-sm font-semibold text-gray-200 hover:bg-gray-900"
                  >
                    {config?.ai.configured ? 'Update AI provider' : 'Configure AI provider'}
                  </button>
                </div>
              )}

              {showGithubSetup && canManageWorkspace && (
                <div className="mt-5 border-y border-gray-800 py-5 space-y-4">
                  <div>
                    <label htmlFor="mission-github-repository" className="block text-sm font-semibold text-gray-200">Repository</label>
                    <input
                      id="mission-github-repository"
                      value={githubForm.repository}
                      onChange={event => setGithubForm(current => ({ ...current, repository: event.target.value }))}
                      placeholder="owner/repository"
                      className="mt-2 w-full h-11 px-3 rounded-md border border-gray-700 bg-gray-900 text-sm text-gray-100 placeholder:text-gray-600 focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                  <div>
                    <label htmlFor="mission-github-token" className="block text-sm font-semibold text-gray-200">Fine-grained access token</label>
                    <input
                      id="mission-github-token"
                      type="password"
                      value={githubForm.token}
                      onChange={event => setGithubForm(current => ({ ...current, token: event.target.value }))}
                      placeholder={config?.github.source === 'workspace' ? `Keep ${config.github.token_preview || 'saved token'}` : 'GitHub token'}
                      autoComplete="off"
                      className="mt-2 w-full h-11 px-3 rounded-md border border-gray-700 bg-gray-900 text-sm text-gray-100 placeholder:text-gray-600 focus:outline-none focus:border-cyan-400"
                    />
                    <p className="mt-2 text-xs leading-5 text-gray-500">Requires repository contents and pull request read/write access. Verification does not change the repository.</p>
                  </div>
                  {githubError && <div role="alert" className="text-sm leading-6 text-red-300">{githubError}</div>}
                  <button
                    type="button"
                    onClick={() => void connectGithub()}
                    disabled={busy === 'github' || !githubForm.repository.trim()}
                    className="w-full min-h-11 px-4 inline-flex items-center justify-center gap-2 rounded-md bg-cyan-400 text-gray-950 text-sm font-bold hover:bg-cyan-300 disabled:opacity-40"
                  >
                    {busy === 'github' ? <Loader2 size={17} className="animate-spin" /> : <ShieldCheck size={17} />}
                    Verify and save
                  </button>
                </div>
              )}

              {selected.data.proposal && !selected.data.pull_request && selected.status === 'proposed' && (
                <div className="mt-6">
                  <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">Reviewed proposal</div>
                  <div
                    className="mt-2 font-mono text-sm text-gray-300"
                    title={selected.proposal_hash || ''}
                  >
                    sha256: {selected.proposal_hash ? `${selected.proposal_hash.slice(0, 12)}...${selected.proposal_hash.slice(-8)}` : 'unavailable'}
                  </div>
                  <button
                    type="button"
                    onClick={() => void approveSelected()}
                    disabled={!!busy || !remote}
                    className="mt-5 w-full min-h-12 px-4 inline-flex items-center justify-center gap-2 rounded-md bg-green-400 text-gray-950 text-sm font-bold hover:bg-green-300 disabled:opacity-40"
                  >
                    {busy === 'approve' ? <Loader2 size={18} className="animate-spin" /> : <GitPullRequest size={18} />}
                    Approve draft pull request
                  </button>
                  <button type="button" onClick={() => void rejectSelected()} disabled={!!busy || !remote} className="mt-3 w-full h-10 rounded-md border border-gray-700 text-sm font-semibold text-gray-300 hover:bg-gray-900 disabled:opacity-40">Reject proposal</button>
                  <p className="mt-3 text-sm leading-6 text-gray-400">Approval is bound to this exact fingerprint and base commit. FetchLab cannot merge or deploy it.</p>
                </div>
              )}

              {selected.status === 'approving' && (
                <div className="mt-6 flex items-start gap-3 border-y border-gray-800 py-5 text-sm leading-6 text-blue-200">
                  <Loader2 size={18} className="animate-spin flex-none mt-0.5" />
                  <span>Opening a draft pull request from the approved fingerprint. Another tab cannot start a second approval.</span>
                </div>
              )}

              {selected.data.pull_request && (
                <div className="mt-6">
                  <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">Draft pull request</div>
                  <a
                    href={selected.data.pull_request.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 min-h-12 px-4 flex items-center justify-between gap-3 rounded-md border border-cyan-500/40 bg-cyan-500/10 text-sm font-semibold text-cyan-100 hover:bg-cyan-500/15"
                  >
                    <span className="truncate">{selected.data.pull_request.repository} #{selected.data.pull_request.number}</span>
                    <ExternalLink size={16} className="flex-none" />
                  </a>
                  <div className="mt-3 text-xs leading-5 text-gray-500">Branch: <span className="font-mono text-gray-400 break-all">{selected.data.pull_request.branch}</span></div>
                  <button
                    type="button"
                    onClick={() => void refreshValidation()}
                    disabled={!!busy || !remote}
                    className="mt-5 w-full h-11 px-4 inline-flex items-center justify-center gap-2 rounded-md border border-gray-700 text-sm font-semibold text-gray-200 hover:bg-gray-900 disabled:opacity-40"
                  >
                    <RefreshCw size={16} className={busy === 'validation' ? 'animate-spin' : ''} /> Refresh repository checks
                  </button>
                </div>
              )}

              {selected.data.validation && (
                <div className="mt-6 border-t border-gray-800 pt-5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold">Repository checks</span>
                    <span className={`text-sm font-bold ${selected.data.validation.state === 'passed' ? 'text-green-400' : selected.data.validation.state === 'failed' ? 'text-red-400' : 'text-amber-400'}`}>
                      {selected.data.validation.state}
                    </span>
                  </div>
                  {selected.data.validation.integrity?.passed === false && (
                    <div className="mt-3 rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm leading-6 text-red-100">
                      <div className="font-semibold">Approved pull request changed</div>
                      {selected.data.validation.integrity.failures.map(failure => (
                        <div key={failure} className="mt-1">{failure}</div>
                      ))}
                    </div>
                  )}
                  {selected.data.validation.checks.length === 0 ? (
                    <div className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs leading-5 text-amber-100/80">No checks reported. This change is unverified.</div>
                  ) : (
                    <div className="mt-3 space-y-2">
                      {selected.data.validation.checks.map(check => (
                        <div key={`${check.name}-${check.url || ''}`} className="flex items-center justify-between gap-3 text-sm">
                          <span className="truncate text-gray-300">{check.name}</span>
                          {check.conclusion === 'success'
                            ? <CheckCircle2 size={16} className="text-green-400 flex-none" />
                            : check.status !== 'completed'
                              ? <Loader2 size={16} className="text-blue-400 animate-spin flex-none" />
                              : <XCircle size={16} className="text-red-400 flex-none" />}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {selected.status === 'rejected' && (
                <div className="mt-6 rounded-md border border-gray-700 bg-gray-900 p-4 text-sm leading-6 text-gray-400">This proposal was rejected. No repository change was created.</div>
              )}

              <div className="mt-8 border-t border-gray-800 pt-5 text-sm leading-6 text-gray-500">
                <div className="flex items-center gap-2 text-gray-400"><ShieldCheck size={14} /> Hard boundary</div>
                <p className="mt-2">Draft branch only. Exact proposal only. No default-branch write. No merge. No deploy.</p>
              </div>
            </aside>
          </>
        ) : null}
      </div>
    </main>
    {showLlmSettings && (
      <Suspense fallback={null}>
        <LLMSettings onClose={() => {
          setShowLlmSettings(false);
          void loadWorkspace();
        }} />
      </Suspense>
    )}
    </>
  );
}
