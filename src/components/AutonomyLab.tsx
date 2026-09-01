import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Activity,
  AlertTriangle,
  Check,
  CheckCircle2,
  Clipboard,
  Cloud,
  Code2,
  Database,
  Download,
  FileJson,
  FlaskConical,
  Link2,
  Loader2,
  Plus,
  Save,
  Scale,
  ShieldCheck,
  Trash2,
  Unlink,
  X,
} from 'lucide-react';
import { useApp } from '../store/useApp';
import { useAuth } from '../auth/useAuth';
import {
  AUTONOMY_LEVELS,
  buildAutonomyContract,
  buildSyntheticRehearsal,
  buildTunnelHandoff,
  createAutonomyStudy,
  levelDefinition,
  recommendLevel,
  redactStudyUrl,
  studyCompleteness,
  summarizeStudy,
  touchStudy,
  type AutonomyLevel,
  type AutonomyStudy,
  type EvidenceObservation,
  type RiskClass,
  type StudySource,
} from '../utils/autonomy';

type LabSection = 'study' | 'variants' | 'pilot' | 'contract';
type SyncStatus = 'local' | 'loading' | 'unsaved' | 'saving' | 'saved' | 'error';

interface AutonomyLabProps {
  onClose: () => void;
  onOpenAdvanced: () => void;
  onOpenRequestBuilder: () => void;
}

interface RemoteStudyRow {
  id: string;
  name: string;
  status: AutonomyStudy['status'];
  data: Partial<AutonomyStudy>;
  created_at?: string;
  updated_at?: string;
}

const SECTION_ITEMS: Array<{ id: LabSection; label: string; icon: typeof Activity }> = [
  { id: 'study', label: 'Study', icon: FileJson },
  { id: 'variants', label: 'Authority', icon: Scale },
  { id: 'pilot', label: 'Pilot', icon: FlaskConical },
  { id: 'contract', label: 'Contract', icon: ShieldCheck },
];

function evidenceId() {
  return 'obs_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

function ruleId() {
  return 'rule_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

function safeStudies(value: unknown): AutonomyStudy[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is AutonomyStudy => {
    if (!item || typeof item !== 'object') return false;
    const study = item as Partial<AutonomyStudy>;
    return typeof study.id === 'string'
      && typeof study.name === 'string'
      && Array.isArray(study.rules)
      && Array.isArray(study.observations);
  });
}

function loadLocalStudies(storageKey: string) {
  try {
    const loaded = safeStudies(JSON.parse(localStorage.getItem(storageKey) || '[]'));
    if (loaded.length) return loaded;
  } catch {
    // Start with a clean local study when browser storage is unavailable or corrupt.
  }
  return [createAutonomyStudy(null)];
}
function fromRemoteRow(row: RemoteStudyRow): AutonomyStudy | null {
  if (!row?.data || typeof row.data !== 'object') return null;
  const candidate = {
    ...row.data,
    id: row.id,
    name: row.name,
    status: row.status,
    createdAt: row.data.createdAt || row.created_at || new Date().toISOString(),
    updatedAt: row.data.updatedAt || row.updated_at || new Date().toISOString(),
  };
  return safeStudies([candidate])[0] || null;
}

function Field({ label, children, wide = false }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <label className={wide ? 'autonomy-field autonomy-field-wide' : 'autonomy-field'}>
      <span>{label}</span>
      {children}
    </label>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="autonomy-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function formatMetric(value: number | null, suffix = '') {
  return value == null ? '-' : String(value) + suffix;
}

export default function AutonomyLab({ onClose, onOpenAdvanced, onOpenRequestBuilder }: AutonomyLabProps) {
  const { state } = useApp();
  const { user, activeWorkspaceId, serverEnabled, authFetch } = useAuth();
  const authFetchRef = useRef(authFetch);
  useEffect(() => {
    authFetchRef.current = authFetch;
  }, [authFetch]);

  const activeTab = state.tabs.find(tab => tab.id === state.activeTabId);
  const request = activeTab ? state.requests[activeTab.requestId] : null;
  const response = activeTab ? state.responses[activeTab.requestId] : null;
  const currentSource = useMemo<StudySource | null>(() => {
    if (!request) return null;
    return {
      requestId: request.id,
      requestName: request.name,
      method: request.method,
      url: redactStudyUrl(request.url),
      observedStatus: response?.status,
      observedLatencyMs: response?.time,
    };
  }, [request, response]);

  const storageKey = 'fetchlab_autonomy_studies_v1:' + (activeWorkspaceId || 'local');
  const remoteEnabled = Boolean(user && serverEnabled && activeWorkspaceId);
  const [section, setSection] = useState<LabSection>('study');
  const [studies, setStudies] = useState<AutonomyStudy[]>(() => loadLocalStudies(storageKey));
  const [activeStudyId, setActiveStudyId] = useState('');
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(() => remoteEnabled ? 'loading' : 'local');
  const [notice, setNotice] = useState('');
  const [pilotLevel, setPilotLevel] = useState<AutonomyLevel>('approval');
  const [pilotOutcome, setPilotOutcome] = useState<'pass' | 'fail'>('pass');
  const [pilotOverridden, setPilotOverridden] = useState(false);
  const [pilotPolicyEvent, setPilotPolicyEvent] = useState(false);
  const [pilotTimeSaved, setPilotTimeSaved] = useState('5');
  const [pilotNote, setPilotNote] = useState('');

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(studies));
    } catch {
      // The study remains usable for the current session when storage is unavailable.
    }
  }, [storageKey, studies]);

  useEffect(() => {
    if (!remoteEnabled || !activeWorkspaceId) return;
    let cancelled = false;
    void (async () => {
      const responseValue = await authFetchRef.current(
        '/api/workspaces/' + encodeURIComponent(activeWorkspaceId) + '/autonomy-studies',
      );
      if (cancelled) return;
      if (!responseValue.ok) {
        setSyncStatus('error');
        return;
      }
      const payload = await responseValue.json() as { studies?: RemoteStudyRow[] };
      const remoteStudies = (payload.studies || [])
        .map(fromRemoteRow)
        .filter((item): item is AutonomyStudy => Boolean(item));
      if (remoteStudies.length) {
        setStudies(remoteStudies);
        setActiveStudyId(remoteStudies[0].id);
      }
      setSyncStatus('saved');
    })().catch(() => {
      if (!cancelled) setSyncStatus('error');
    });
    return () => { cancelled = true; };
  }, [activeWorkspaceId, remoteEnabled]);

  const activeStudy = studies.find(study => study.id === activeStudyId) || studies[0] || null;
  const evidenceSummaries = activeStudy ? summarizeStudy(activeStudy) : [];
  const pilotSummaries = activeStudy
    ? summarizeStudy({ ...activeStudy, observations: activeStudy.observations.filter(item => item.source === 'pilot') })
    : [];
  const recommendation = activeStudy ? recommendLevel(activeStudy) : null;
  const completeness = activeStudy ? studyCompleteness(activeStudy) : null;
  const pilotCount = activeStudy?.observations.filter(item => item.source === 'pilot').length || 0;
  const syntheticCount = activeStudy?.observations.filter(item => item.source === 'synthetic').length || 0;
  const activeRules = activeStudy?.rules.filter(rule => rule.enabled).length || 0;
  const contract = activeStudy ? buildAutonomyContract(activeStudy, activeWorkspaceId) : null;
  const tunnelHandoff = activeStudy ? buildTunnelHandoff(activeStudy, activeWorkspaceId) : null;

  function replaceActive(next: AutonomyStudy) {
    setStudies(current => current.map(study => study.id === next.id ? next : study));
    setSyncStatus(remoteEnabled ? 'unsaved' : 'local');
  }

  function updateActive(updates: Partial<AutonomyStudy>) {
    if (!activeStudy) return;
    replaceActive(touchStudy(activeStudy, updates));
  }

  function createStudy() {
    const next = createAutonomyStudy(currentSource);
    if (user) next.owner = user.name || user.email;
    setStudies(current => [next, ...current]);
    setActiveStudyId(next.id);
    setSection('study');
    setSyncStatus(remoteEnabled ? 'unsaved' : 'local');
  }

  async function removeStudy() {
    if (!activeStudy) return;
    const remaining = studies.filter(study => study.id !== activeStudy.id);
    const nextStudies = remaining.length ? remaining : [createAutonomyStudy(null)];
    setStudies(nextStudies);
    setActiveStudyId(nextStudies[0].id);
    if (remoteEnabled && activeWorkspaceId) {
      await authFetchRef.current(
        '/api/workspaces/' + encodeURIComponent(activeWorkspaceId)
          + '/autonomy-studies/' + encodeURIComponent(activeStudy.id),
        { method: 'DELETE' },
      );
    }
    setSyncStatus(remoteEnabled ? 'saved' : 'local');
  }

  async function saveStudy() {
    if (!activeStudy) return false;
    if (!remoteEnabled || !activeWorkspaceId) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(studies));
        setSyncStatus('local');
        setNotice('Saved on this device');
        return true;
      } catch {
        setSyncStatus('error');
        return false;
      }
    }

    setSyncStatus('saving');
    const responseValue = await authFetchRef.current(
      '/api/workspaces/' + encodeURIComponent(activeWorkspaceId) + '/autonomy-studies',
      {
        method: 'POST',
        body: JSON.stringify({
          id: activeStudy.id,
          name: activeStudy.name,
          status: activeStudy.status,
          data: activeStudy,
        }),
      },
    );
    if (!responseValue.ok) {
      setSyncStatus('error');
      return false;
    }
    const payload = await responseValue.json() as { study?: RemoteStudyRow };
    const saved = payload.study ? fromRemoteRow(payload.study) : null;
    if (saved) setStudies(current => current.map(study => study.id === saved.id ? saved : study));
    setSyncStatus('saved');
    setNotice('Synced to workspace');
    return true;
  }

  async function sendToTunnel() {
    if (!activeStudy || !remoteEnabled || !activeWorkspaceId) {
      setNotice('Copy the Tunnel task for a local or standalone workflow');
      return;
    }
    const saved = await saveStudy();
    if (!saved) return;
    const responseValue = await authFetchRef.current(
      '/api/workspaces/' + encodeURIComponent(activeWorkspaceId)
        + '/autonomy-studies/' + encodeURIComponent(activeStudy.id) + '/tunnel',
      { method: 'POST', body: JSON.stringify({ handoff: tunnelHandoff }) },
    );
    const payload = await responseValue.json().catch(() => ({})) as { task_id?: string; error?: string };
    if (!responseValue.ok || !payload.task_id) {
      setNotice(payload.error || 'Tunnel handoff failed. Copy the task instead.');
      return;
    }
    setNotice('Tunnel task ' + payload.task_id + ' created');
  }

  function runRehearsal() {
    if (!activeStudy) return;
    const pilots = activeStudy.observations.filter(item => item.source === 'pilot');
    updateActive({
      observations: [...pilots, ...buildSyntheticRehearsal(activeStudy)],
      status: pilots.length ? 'pilot' : 'rehearsal',
    });
    setNotice('Rehearsal evidence added');
  }

  function addPilotObservation() {
    if (!activeStudy) return;
    const timeSaved = Number(pilotTimeSaved);
    const observation: EvidenceObservation = {
      id: evidenceId(),
      level: pilotLevel,
      source: 'pilot',
      outcome: pilotOutcome,
      overridden: pilotOverridden,
      policyEvent: pilotPolicyEvent,
      timeSavedMinutes: Number.isFinite(timeSaved) ? Math.max(0, timeSaved) : 0,
      note: pilotNote.trim(),
      createdAt: new Date().toISOString(),
    };
    updateActive({
      observations: [observation, ...activeStudy.observations],
      status: 'pilot',
    });
    setPilotNote('');
    setPilotOverridden(false);
    setPilotPolicyEvent(false);
    setNotice('Pilot observation recorded');
  }

  function removeObservation(id: string) {
    if (!activeStudy) return;
    updateActive({ observations: activeStudy.observations.filter(item => item.id !== id) });
  }

  function updateRule(id: string, updates: Partial<AutonomyStudy['rules'][number]>) {
    if (!activeStudy) return;
    updateActive({
      rules: activeStudy.rules.map(rule => rule.id === id ? { ...rule, ...updates } : rule),
    });
  }

  function addRule() {
    if (!activeStudy) return;
    updateActive({
      rules: [
        ...activeStudy.rules,
        { id: ruleId(), condition: '', action: '', enabled: true },
      ],
    });
  }

  function removeRule(id: string) {
    if (!activeStudy) return;
    updateActive({ rules: activeStudy.rules.filter(rule => rule.id !== id) });
  }

  async function copyText(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = value;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      textArea.remove();
    }
    setNotice(label + ' copied');
  }

  function downloadJson(filename: string, value: unknown) {
    const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
    setNotice(filename + ' downloaded');
  }

  if (!activeStudy || !completeness || !recommendation || !contract || !tunnelHandoff) {
    return (
      <div className="autonomy-shell" role="dialog" aria-modal="true" aria-label="Autonomy Lab">
        <div className="autonomy-loading"><Loader2 size={22} className="animate-spin" /> Loading studies</div>
      </div>
    );
  }

  const selectedDefinition = levelDefinition(activeStudy.selectedLevel);
  const missingScope = [
    !activeStudy.workflow && 'Workflow',
    !activeStudy.targetUsers && 'Target users',
    !activeStudy.successDefinition && 'Success definition',
    !activeStudy.owner && 'Owner',
  ].filter(Boolean) as string[];
  const syncLabel: Record<SyncStatus, string> = {
    local: 'Saved locally',
    loading: 'Loading workspace',
    unsaved: 'Unsaved changes',
    saving: 'Saving',
    saved: 'Workspace synced',
    error: 'Sync unavailable',
  };

  return (
    <div className="autonomy-shell" role="dialog" aria-modal="true" aria-label="Autonomy Lab">
      <header className="autonomy-topbar">
        <div className="autonomy-brand">
          <div className="autonomy-brand-mark"><Scale size={19} /></div>
          <div>
            <h1>Autonomy Lab</h1>
            <span>Decision evidence for AI workflows</span>
          </div>
        </div>

        <div className="autonomy-study-tools">
          <select
            aria-label="Active autonomy study"
            value={activeStudy.id}
            onChange={event => setActiveStudyId(event.target.value)}
          >
            {studies.map(study => <option key={study.id} value={study.id}>{study.name}</option>)}
          </select>
          <button className="autonomy-icon-button" onClick={createStudy} title="Create study" aria-label="Create study">
            <Plus size={17} />
          </button>
          <button className="autonomy-icon-button autonomy-danger-button" onClick={() => void removeStudy()} title="Delete study" aria-label="Delete study">
            <Trash2 size={16} />
          </button>
        </div>

        <div className="autonomy-top-actions">
          <span className={'autonomy-sync autonomy-sync-' + syncStatus} title={syncLabel[syncStatus]}>
            {remoteEnabled ? <Cloud size={14} /> : <Database size={14} />}
            <span>{syncLabel[syncStatus]}</span>
          </span>
          <button className="autonomy-button autonomy-button-secondary" onClick={onOpenAdvanced}>
            <Code2 size={16} /> Advanced tools
          </button>
          <button className="autonomy-button autonomy-button-primary" onClick={() => void saveStudy()}>
            {syncStatus === 'saving' ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Save
          </button>
          <button className="autonomy-icon-button" onClick={onClose} title="Close Autonomy Lab" aria-label="Close Autonomy Lab">
            <X size={19} />
          </button>
        </div>
      </header>

      <nav className="autonomy-nav" aria-label="Autonomy study sections">
        {SECTION_ITEMS.map(item => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              className={section === item.id ? 'active' : ''}
              onClick={() => setSection(item.id)}
            >
              <Icon size={16} />
              {item.label}
              {item.id === 'contract' && activeStudy.status === 'decided' && <Check size={14} />}
            </button>
          );
        })}
      </nav>

      <div className="autonomy-content">
        <main className="autonomy-main">
          {notice && (
            <div className="autonomy-notice" role="status">
              <CheckCircle2 size={16} />
              {notice}
              <button onClick={() => setNotice('')} aria-label="Dismiss message"><X size={14} /></button>
            </div>
          )}

          {section === 'study' && (
            <section className="autonomy-page" aria-labelledby="autonomy-study-heading">
              <div className="autonomy-page-heading">
                <div>
                  <span className="autonomy-kicker">Decision scope</span>
                  <h2 id="autonomy-study-heading">What work should the AI own?</h2>
                </div>
                <select
                  aria-label="Study risk"
                  value={activeStudy.riskClass}
                  onChange={event => updateActive({ riskClass: event.target.value as RiskClass })}
                >
                  <option value="low">Low risk</option>
                  <option value="medium">Medium risk</option>
                  <option value="high">High risk</option>
                </select>
              </div>

              <div className="autonomy-form-grid">
                <Field label="Study name" wide>
                  <input
                    value={activeStudy.name}
                    onChange={event => updateActive({ name: event.target.value })}
                    placeholder="Refund exception handling study"
                  />
                </Field>
                <Field label="Workflow" wide>
                  <textarea
                    rows={5}
                    value={activeStudy.workflow}
                    onChange={event => updateActive({ workflow: event.target.value })}
                    placeholder="Describe the trigger, decision, action, downstream system, and final state."
                  />
                </Field>
                <Field label="Target users">
                  <input
                    value={activeStudy.targetUsers}
                    onChange={event => updateActive({ targetUsers: event.target.value })}
                    placeholder="Support leads handling escalations"
                  />
                </Field>
                <Field label="Decision owner">
                  <input
                    value={activeStudy.owner}
                    onChange={event => updateActive({ owner: event.target.value })}
                    placeholder="Name or accountable team"
                  />
                </Field>
                <Field label="Successful outcome" wide>
                  <textarea
                    rows={3}
                    value={activeStudy.successDefinition}
                    onChange={event => updateActive({ successDefinition: event.target.value })}
                    placeholder="State the observable business result and how the downstream system confirms it."
                  />
                </Field>
              </div>

              <div className="autonomy-source-band">
                <div>
                  <span className="autonomy-band-label">API evidence source</span>
                  {activeStudy.source ? (
                    <strong>
                      {activeStudy.source.method} {activeStudy.source.requestName || activeStudy.source.url}
                    </strong>
                  ) : (
                    <strong>No API context attached</strong>
                  )}
                  {activeStudy.source?.url && <code>{activeStudy.source.url}</code>}
                </div>
                <div className="autonomy-inline-actions">
                  {activeStudy.source ? (
                    <button className="autonomy-button autonomy-button-secondary" onClick={() => updateActive({ source: null })}>
                      <Unlink size={15} /> Detach
                    </button>
                  ) : currentSource ? (
                    <button className="autonomy-button autonomy-button-secondary" onClick={() => updateActive({ source: currentSource })}>
                      <Link2 size={15} /> Attach current API
                    </button>
                  ) : (
                    <button className="autonomy-button autonomy-button-secondary" onClick={onOpenRequestBuilder}>
                      <Plus size={15} /> Create AI request
                    </button>
                  )}
                </div>
              </div>
            </section>
          )}

          {section === 'variants' && (
            <section className="autonomy-page" aria-labelledby="autonomy-variants-heading">
              <div className="autonomy-page-heading">
                <div>
                  <span className="autonomy-kicker">Authority decision</span>
                  <h2 id="autonomy-variants-heading">Select the operating boundary</h2>
                </div>
                <span className="autonomy-owner-decision">Owner selected: {selectedDefinition.shortLabel}</span>
              </div>

              <div className="autonomy-variant-list" role="radiogroup" aria-label="Autonomy level">
                {AUTONOMY_LEVELS.map(level => {
                  const summary = pilotSummaries.find(item => item.level === level.id);
                  const selected = activeStudy.selectedLevel === level.id;
                  return (
                    <button
                      key={level.id}
                      role="radio"
                      aria-checked={selected}
                      className={'autonomy-variant-row' + (selected ? ' selected' : '')}
                      onClick={() => updateActive({ selectedLevel: level.id })}
                    >
                      <span className="autonomy-radio">{selected && <Check size={14} />}</span>
                      <span className="autonomy-variant-copy">
                        <strong>{level.label}</strong>
                        <span>{level.authority}</span>
                        <small>{level.humanRole}</small>
                      </span>
                      <span className="autonomy-variant-metrics">
                        <Metric label="Pilot" value={String(summary?.pilotSampleSize || 0)} />
                        <Metric label="Success" value={formatMetric(summary?.successRate ?? null, '%')} />
                        <Metric label="Policy events" value={formatMetric(summary?.policyEventRate ?? null, '%')} />
                        <Metric label="Time saved" value={formatMetric(summary?.averageTimeSaved ?? null, 'm')} />
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className={'autonomy-recommendation autonomy-confidence-' + recommendation.confidence}>
                <div><Activity size={18} /></div>
                <div>
                  <span>Evidence recommendation</span>
                  <strong>{levelDefinition(recommendation.level).label}</strong>
                  <p>{recommendation.reason}</p>
                </div>
                <span className="autonomy-confidence">{recommendation.confidence} confidence</span>
              </div>
            </section>
          )}

          {section === 'pilot' && (
            <section className="autonomy-page" aria-labelledby="autonomy-pilot-heading">
              <div className="autonomy-page-heading">
                <div>
                  <span className="autonomy-kicker">Observed evidence</span>
                  <h2 id="autonomy-pilot-heading">Test authority against real work</h2>
                </div>
                <button className="autonomy-button autonomy-button-secondary" onClick={runRehearsal}>
                  <FlaskConical size={16} /> Run synthetic rehearsal
                </button>
              </div>

              <div className="autonomy-warning-band">
                <AlertTriangle size={18} />
                <div>
                  <strong>Synthetic rehearsal is non-authorizing</strong>
                  <span>Only pilot observations from real workflows can raise the evidence recommendation.</span>
                </div>
              </div>

              <div className="autonomy-pilot-entry">
                <h3>Record pilot observation</h3>
                <div className="autonomy-pilot-grid">
                  <Field label="Authority tested">
                    <select value={pilotLevel} onChange={event => setPilotLevel(event.target.value as AutonomyLevel)}>
                      {AUTONOMY_LEVELS.map(level => <option key={level.id} value={level.id}>{level.label}</option>)}
                    </select>
                  </Field>
                  <Field label="Outcome">
                    <div className="autonomy-segmented">
                      <button className={pilotOutcome === 'pass' ? 'active' : ''} onClick={() => setPilotOutcome('pass')}>Pass</button>
                      <button className={pilotOutcome === 'fail' ? 'active' : ''} onClick={() => setPilotOutcome('fail')}>Fail</button>
                    </div>
                  </Field>
                  <Field label="Minutes saved">
                    <input type="number" min="0" step="0.5" value={pilotTimeSaved} onChange={event => setPilotTimeSaved(event.target.value)} />
                  </Field>
                  <Field label="Evidence note" wide>
                    <input value={pilotNote} onChange={event => setPilotNote(event.target.value)} placeholder="Observed outcome, exception, or reviewer concern" />
                  </Field>
                </div>
                <div className="autonomy-pilot-actions">
                  <label><input type="checkbox" checked={pilotOverridden} onChange={event => setPilotOverridden(event.target.checked)} /> Human override</label>
                  <label><input type="checkbox" checked={pilotPolicyEvent} onChange={event => setPilotPolicyEvent(event.target.checked)} /> Policy event</label>
                  <button className="autonomy-button autonomy-button-primary" onClick={addPilotObservation}>
                    <Plus size={16} /> Add pilot observation
                  </button>
                </div>
              </div>

              <div className="autonomy-table-wrap">
                <table className="autonomy-table">
                  <thead>
                    <tr>
                      <th>Authority</th>
                      <th>Evidence</th>
                      <th>Pilot success</th>
                      <th>Pilot override</th>
                      <th>Pilot policy events</th>
                      <th>Pilot avg saved</th>
                      <th>Pilot score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {evidenceSummaries.map(summary => {
                      const pilotSummary = pilotSummaries.find(item => item.level === summary.level) || summary;
                      return (
                        <tr key={summary.level}>
                          <td><strong>{levelDefinition(summary.level).shortLabel}</strong></td>
                          <td>{summary.pilotSampleSize} pilot / {summary.syntheticSampleSize} simulated</td>
                          <td>{formatMetric(pilotSummary.successRate, '%')}</td>
                          <td>{formatMetric(pilotSummary.overrideRate, '%')}</td>
                          <td>{formatMetric(pilotSummary.policyEventRate, '%')}</td>
                          <td>{formatMetric(pilotSummary.averageTimeSaved, ' min')}</td>
                          <td>{formatMetric(pilotSummary.score)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="autonomy-evidence-log">
                <h3>Evidence log <span>{activeStudy.observations.length}</span></h3>
                {!activeStudy.observations.length ? (
                  <div className="autonomy-empty">No evidence recorded.</div>
                ) : activeStudy.observations.slice(0, 20).map(observation => (
                  <div className="autonomy-evidence-row" key={observation.id}>
                    <span className={'autonomy-source-tag ' + observation.source}>{observation.source === 'pilot' ? 'Pilot' : 'Simulated'}</span>
                    <strong>{levelDefinition(observation.level).shortLabel}</strong>
                    <span className={observation.outcome === 'pass' ? 'autonomy-pass' : 'autonomy-fail'}>{observation.outcome}</span>
                    <span>{observation.timeSavedMinutes} min saved</span>
                    <span className="autonomy-evidence-note">{observation.note || 'No note'}</span>
                    <button className="autonomy-icon-button" onClick={() => removeObservation(observation.id)} title="Remove observation" aria-label="Remove observation">
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {section === 'contract' && (
            <section className="autonomy-page" aria-labelledby="autonomy-contract-heading">
              <div className="autonomy-page-heading">
                <div>
                  <span className="autonomy-kicker">Executable decision</span>
                  <h2 id="autonomy-contract-heading">Autonomy contract</h2>
                </div>
                <button
                  className="autonomy-button autonomy-button-primary"
                  disabled={!completeness.ready}
                  onClick={() => updateActive({ status: 'decided' })}
                >
                  <ShieldCheck size={16} /> Mark decision final
                </button>
              </div>

              <div className="autonomy-contract-summary">
                <div>
                  <span>Selected authority</span>
                  <strong>{selectedDefinition.label}</strong>
                  <p>{selectedDefinition.authority}. {selectedDefinition.humanRole}.</p>
                </div>
                <div>
                  <span>Risk</span>
                  <strong>{activeStudy.riskClass}</strong>
                </div>
                <div>
                  <span>Evidence basis</span>
                  <strong>{recommendation.basis === 'pilot-evidence' ? 'Pilot evidence' : 'Owner decision'}</strong>
                </div>
              </div>

              <div className="autonomy-rules">
                <div className="autonomy-subheading">
                  <div>
                    <h3>Policy rules</h3>
                    <span>{activeRules} enabled</span>
                  </div>
                  <button className="autonomy-button autonomy-button-secondary" onClick={addRule}><Plus size={15} /> Add rule</button>
                </div>
                {activeStudy.rules.map(rule => (
                  <div className="autonomy-rule-row" key={rule.id}>
                    <input
                      type="checkbox"
                      checked={rule.enabled}
                      onChange={event => updateRule(rule.id, { enabled: event.target.checked })}
                      aria-label="Enable policy rule"
                    />
                    <input
                      value={rule.condition}
                      onChange={event => updateRule(rule.id, { condition: event.target.value })}
                      placeholder="When..."
                      aria-label="Policy condition"
                    />
                    <input
                      value={rule.action}
                      onChange={event => updateRule(rule.id, { action: event.target.value })}
                      placeholder="Then..."
                      aria-label="Policy action"
                    />
                    <button className="autonomy-icon-button" onClick={() => removeRule(rule.id)} title="Delete rule" aria-label="Delete rule">
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>

              <div className="autonomy-export-grid">
                <div className="autonomy-export-panel">
                  <div className="autonomy-subheading">
                    <div>
                      <h3>FetchLab contract</h3>
                      <span>Machine-readable decision record</span>
                    </div>
                    <div className="autonomy-inline-actions">
                      <button className="autonomy-icon-button" title="Copy contract" aria-label="Copy contract" onClick={() => void copyText('Contract', JSON.stringify(contract, null, 2))}><Clipboard size={16} /></button>
                      <button className="autonomy-icon-button" title="Download contract" aria-label="Download contract" onClick={() => downloadJson('fetchlab-autonomy-contract.json', contract)}><Download size={16} /></button>
                    </div>
                  </div>
                  <pre>{JSON.stringify(contract, null, 2)}</pre>
                </div>

                <div className="autonomy-export-panel autonomy-tunnel-panel">
                  <div className="autonomy-subheading">
                    <div>
                      <h3>Tunnel build task</h3>
                      <span>Implementation handoff</span>
                    </div>
                    <Code2 size={18} />
                  </div>
                  <dl>
                    <div><dt>Objective</dt><dd>{activeStudy.name}</dd></div>
                    <div><dt>Authority ceiling</dt><dd>{selectedDefinition.label}</dd></div>
                    <div><dt>Policy rules</dt><dd>{activeRules}</dd></div>
                    <div><dt>Budget mode</dt><dd>{tunnelHandoff.budget_mode}</dd></div>
                  </dl>
                  <p>The handoff gives Tunnel the implementation objective, acceptance criteria, policy boundaries, and evidence contract. Tunnel owns agent orchestration and code assembly.</p>
                  <div className="autonomy-stack-actions">
                    {remoteEnabled && (
                      <button className="autonomy-button autonomy-button-primary" onClick={() => void sendToTunnel()}>
                        <Cloud size={16} /> Send to Tunnel
                      </button>
                    )}
                    <button className={'autonomy-button ' + (remoteEnabled ? 'autonomy-button-secondary' : 'autonomy-button-primary')} onClick={() => void copyText('Tunnel task', JSON.stringify(tunnelHandoff, null, 2))}>
                      <Clipboard size={16} /> Copy Tunnel task
                    </button>
                    <button className="autonomy-button autonomy-button-secondary" onClick={() => downloadJson('fetchlab-tunnel-task.json', tunnelHandoff)}>
                      <Download size={16} /> Download JSON
                    </button>
                  </div>
                </div>
              </div>
            </section>
          )}
        </main>

        <aside className="autonomy-rail" aria-label="Study readiness">
          <div className="autonomy-rail-section">
            <span className="autonomy-kicker">Decision readiness</span>
            <div className="autonomy-readiness-score">
              <strong>{completeness.percent}%</strong>
              <span>{activeStudy.status}</span>
            </div>
            <div className="autonomy-progress"><span style={{ width: completeness.percent + '%' }} /></div>
          </div>

          <div className="autonomy-rail-section">
            <span className="autonomy-rail-label">Authority ceiling</span>
            <strong className="autonomy-rail-value">{selectedDefinition.label}</strong>
            <p>{selectedDefinition.authority}</p>
          </div>

          <div className="autonomy-rail-stats">
            <Metric label="Pilot evidence" value={String(pilotCount)} />
            <Metric label="Simulation" value={String(syntheticCount)} />
            <Metric label="Rules" value={String(activeRules)} />
            <Metric label="Risk" value={activeStudy.riskClass} />
          </div>

          <div className="autonomy-rail-section">
            <span className="autonomy-rail-label">Evidence recommendation</span>
            <strong className="autonomy-rail-value">{levelDefinition(recommendation.level).label}</strong>
            <p>{recommendation.reason}</p>
          </div>

          <div className="autonomy-rail-section">
            <span className="autonomy-rail-label">Readiness blockers</span>
            <ul className="autonomy-blockers">
              {missingScope.map(item => <li key={item}><AlertTriangle size={14} /> Define {item.toLowerCase()}</li>)}
              {!pilotCount && <li><FlaskConical size={14} /> No real pilot evidence</li>}
              {!activeRules && <li><ShieldCheck size={14} /> No policy rules enabled</li>}
              {!missingScope.length && pilotCount > 0 && activeRules > 0 && <li className="ready"><CheckCircle2 size={14} /> Decision record complete</li>}
            </ul>
          </div>

          {activeStudy.source && (
            <div className="autonomy-rail-section">
              <span className="autonomy-rail-label">Attached API</span>
              <strong className="autonomy-rail-value">{activeStudy.source.method} {activeStudy.source.requestName}</strong>
              <p>
                {activeStudy.source.observedStatus ? 'Status ' + activeStudy.source.observedStatus : 'No response captured'}
                {activeStudy.source.observedLatencyMs ? ' / ' + activeStudy.source.observedLatencyMs + ' ms' : ''}
              </p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
