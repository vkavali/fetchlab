import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../auth/useAuth';
import {
  X, Bot, RefreshCw, AlertTriangle, CheckCircle2, Clock, GitPullRequest,
  Power, Hash, PlayCircle, Pause,
} from 'lucide-react';

interface AgentIssue {
  id: string;
  workspace_id: string | null;
  channel_type: string;
  channel_id: string | null;
  channel_name: string | null;
  message_text: string;
  endpoint: string | null;
  method: string | null;
  error_code: number | null;
  status: string;
  diagnosis: { summary?: string; severity?: string; likelyCause?: string; fixes?: { title: string; detail: string }[] } | null;
  fix: { pr_url?: string } | null;
  test_result: { success?: boolean; status?: number; time?: number } | null;
  detected_at: string;
}

interface AgentConfig {
  id: string;
  workspace_id: string | null;
  channel_type: string;
  channel_id: string;
  channel_name: string | null;
  enabled: boolean;
  sensitivity: 'low' | 'medium' | 'high';
  auto_fix: boolean;
}

interface AgentStatus {
  slackEnabled: boolean;
  githubEnabled: boolean;
  aiEnabled: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  detected: 'text-blue-400 bg-blue-500/10',
  reproducing: 'text-purple-400 bg-purple-500/10',
  diagnosed: 'text-yellow-400 bg-yellow-500/10',
  fixed: 'text-green-400 bg-green-500/10',
  applied: 'text-green-500 bg-green-500/15',
  pr_opened: 'text-cyan-400 bg-cyan-500/10',
  ignored: 'text-gray-500 bg-gray-500/10',
  snoozed: 'text-orange-400 bg-orange-500/10',
  transient: 'text-gray-400 bg-gray-500/10',
};

export default function AgentDashboard({ onClose }: { onClose: () => void }) {
  const { authFetch, activeWorkspaceId } = useAuth();
  const [tab, setTab] = useState<'feed' | 'config' | 'test'>('feed');
  const [issues, setIssues] = useState<AgentIssue[]>([]);
  const [configs, setConfigs] = useState<AgentConfig[]>([]);
  const [status, setStatus] = useState<AgentStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<AgentIssue | null>(null);

  // Test form
  const [testText, setTestText] = useState('The /users endpoint is returning 500 errors when we POST');
  const [testSensitivity, setTestSensitivity] = useState<'low' | 'medium' | 'high'>('medium');
  const [testResult, setTestResult] = useState<AgentIssue | null>(null);
  const [testing, setTesting] = useState(false);

  // Config form
  const [newChannelId, setNewChannelId] = useState('');
  const [newChannelName, setNewChannelName] = useState('');
  const [newSensitivity, setNewSensitivity] = useState<'low' | 'medium' | 'high'>('medium');
  const [newAutoFix, setNewAutoFix] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [iRes, cRes, sRes] = await Promise.all([
        authFetch(`/api/agent/issues${activeWorkspaceId ? `?workspace_id=${activeWorkspaceId}` : ''}`),
        authFetch(`/api/agent/config${activeWorkspaceId ? `?workspace_id=${activeWorkspaceId}` : ''}`),
        authFetch('/api/agent/status'),
      ]);
      if (iRes.ok) setIssues((await iRes.json()).issues || []);
      if (cRes.ok) setConfigs((await cRes.json()).configs || []);
      if (sRes.ok) setStatus(await sRes.json());
    } finally {
      setLoading(false);
    }
  }, [authFetch, activeWorkspaceId]);

  useEffect(() => { refresh(); }, [refresh]);

  const act = async (issueId: string, action: 'approve' | 'ignore' | 'snooze' | 'open-pr') => {
    const res = await authFetch(`/api/agent/issues/${issueId}/${action}`, { method: 'POST' });
    if (res.ok) {
      await refresh();
      if (selectedIssue?.id === issueId) {
        const updated = (await res.json()).issue;
        if (updated) setSelectedIssue(updated);
      }
    } else {
      const err = await res.json().catch(() => ({}));
      alert(`Failed: ${err.error || res.statusText}`);
    }
  };

  const saveConfig = async () => {
    if (!newChannelId.trim()) return;
    const res = await authFetch('/api/agent/configure', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspace_id: activeWorkspaceId,
        channel_type: 'slack',
        channel_id: newChannelId.trim(),
        channel_name: newChannelName.trim() || null,
        enabled: true,
        sensitivity: newSensitivity,
        auto_fix: newAutoFix,
      }),
    });
    if (res.ok) {
      setNewChannelId('');
      setNewChannelName('');
      await refresh();
    }
  };

  const toggleConfig = async (cfg: AgentConfig) => {
    await authFetch(`/api/agent/settings/${cfg.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...cfg, enabled: !cfg.enabled }),
    });
    await refresh();
  };

  const updateConfigSensitivity = async (cfg: AgentConfig, sensitivity: 'low' | 'medium' | 'high') => {
    await authFetch(`/api/agent/settings/${cfg.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...cfg, sensitivity }),
    });
    await refresh();
  };

  const removeConfig = async (id: string) => {
    if (!confirm('Stop monitoring this channel?')) return;
    await authFetch(`/api/agent/config/${id}`, { method: 'DELETE' });
    await refresh();
  };

  const runTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await authFetch('/api/agent/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: testText,
          channel_id: 'dashboard-test',
          channel_name: 'dashboard',
          workspace_id: activeWorkspaceId,
          sensitivity: testSensitivity,
        }),
      });
      const data = await res.json();
      setTestResult(data.issue);
      await refresh();
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-[900px] max-w-[95vw] h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <Bot size={18} className="text-purple-400" />
            <h2 className="text-base font-bold text-gray-100">AI Ops Agent</h2>
            {status && (
              <div className="flex items-center gap-1.5 ml-3">
                <Badge ok={status.aiEnabled} label="AI" />
                <Badge ok={status.slackEnabled} label="Slack" />
                <Badge ok={status.githubEnabled} label="GitHub" />
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={refresh} className="p-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-gray-800" title="Refresh">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-gray-800">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 px-3 border-b border-gray-800">
          <TabButton active={tab === 'feed'} onClick={() => setTab('feed')}>Activity Feed</TabButton>
          <TabButton active={tab === 'config'} onClick={() => setTab('config')}>Channels</TabButton>
          <TabButton active={tab === 'test'} onClick={() => setTab('test')}>Test Detection</TabButton>
        </div>

        <div className="flex-1 overflow-hidden flex">
          {tab === 'feed' && (
            issues.length === 0 ? (
              <EmptyFeed
                onOpenTest={() => setTab('test')}
                onOpenConfig={() => setTab('config')}
                slackConfigured={configs.length > 0}
              />
            ) : (
              <>
                <div className="w-1/2 overflow-y-auto" style={{ borderRight: '1px solid var(--color-border)' }}>
                  <div className="divide-y divide-gray-800">
                    {issues.map(issue => (
                      <button
                        key={issue.id}
                        onClick={() => setSelectedIssue(issue)}
                        className={`w-full text-left px-4 py-3 hover:bg-gray-800/50 transition-colors ${
                          selectedIssue?.id === issue.id ? 'bg-gray-800/70' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded ${STATUS_COLORS[issue.status] || 'text-gray-400 bg-gray-500/10'}`}>
                              {issue.status}
                            </span>
                            {issue.method && (
                              <span className="text-[10px] font-mono font-bold text-purple-400">{issue.method}</span>
                            )}
                            {issue.error_code && (
                              <span className="text-[10px] font-mono text-red-400">{issue.error_code}</span>
                            )}
                          </div>
                          <span className="text-[10px] text-gray-600">{new Date(issue.detected_at).toLocaleTimeString()}</span>
                        </div>
                        {issue.endpoint && (
                          <div className="text-xs font-mono text-gray-300 truncate mb-1">{issue.endpoint}</div>
                        )}
                        <div className="text-xs text-gray-500 truncate">{issue.message_text}</div>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="w-1/2 overflow-y-auto p-4">
                  {selectedIssue ? (
                    <IssueDetail issue={selectedIssue} onAct={act} />
                  ) : (
                    <div
                      className="font-mono"
                      style={{
                        textAlign: 'center',
                        fontSize: 10.5,
                        letterSpacing: '0.18em',
                        textTransform: 'uppercase',
                        color: 'var(--color-text-subtle)',
                        marginTop: 48,
                      }}
                    >
                      Pick a specimen on the left
                    </div>
                  )}
                </div>
              </>
            )
          )}

          {tab === 'config' && (
            <div className="flex-1 overflow-y-auto p-5">
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-200 mb-2">Add a Slack channel</h3>
                <p className="text-xs text-gray-500 mb-3">
                  Paste a Slack channel ID (e.g. <code className="bg-gray-800 px-1 rounded">C0123456789</code>). The bot must already be invited to the channel.
                </p>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <input
                    placeholder="Channel ID"
                    value={newChannelId}
                    onChange={e => setNewChannelId(e.target.value)}
                    className="px-3 py-2 bg-gray-800 border border-gray-700 rounded text-xs text-gray-100"
                  />
                  <input
                    placeholder="Display name (optional)"
                    value={newChannelName}
                    onChange={e => setNewChannelName(e.target.value)}
                    className="px-3 py-2 bg-gray-800 border border-gray-700 rounded text-xs text-gray-100"
                  />
                </div>
                <div className="flex items-center gap-3 mb-3">
                  <label className="flex items-center gap-1.5 text-xs text-gray-400">
                    Sensitivity:
                    <select
                      value={newSensitivity}
                      onChange={e => setNewSensitivity(e.target.value as 'low' | 'medium' | 'high')}
                      className="px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs"
                    >
                      <option value="low">Low (very strict)</option>
                      <option value="medium">Medium</option>
                      <option value="high">High (chatty)</option>
                    </select>
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-gray-400">
                    <input type="checkbox" checked={newAutoFix} onChange={e => setNewAutoFix(e.target.checked)} />
                    Auto-apply low-risk fixes
                  </label>
                </div>
                <button
                  onClick={saveConfig}
                  disabled={!newChannelId.trim()}
                  className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-semibold rounded"
                >
                  Add channel
                </button>
              </div>

              <div className="border-t border-gray-800 pt-4">
                <h3 className="text-sm font-semibold text-gray-200 mb-2">Monitored channels</h3>
                {configs.length === 0 ? (
                  <p className="text-xs text-gray-500">No channels configured.</p>
                ) : (
                  <div className="space-y-2">
                    {configs.map(cfg => (
                      <div key={cfg.id} className="flex items-center gap-3 px-3 py-2 bg-gray-800/40 border border-gray-800 rounded">
                        <Hash size={14} className="text-gray-500" />
                        <div className="flex-1">
                          <div className="text-xs font-medium text-gray-200">{cfg.channel_name || cfg.channel_id}</div>
                          <div className="text-[10px] text-gray-500 font-mono">{cfg.channel_id}</div>
                        </div>
                        <select
                          value={cfg.sensitivity}
                          onChange={e => updateConfigSensitivity(cfg, e.target.value as 'low' | 'medium' | 'high')}
                          className="px-2 py-1 bg-gray-900 border border-gray-700 rounded text-[10px]"
                        >
                          <option value="low">Low</option>
                          <option value="medium">Med</option>
                          <option value="high">High</option>
                        </select>
                        <button
                          onClick={() => toggleConfig(cfg)}
                          className={`p-1.5 rounded ${cfg.enabled ? 'text-green-400 hover:bg-green-500/10' : 'text-gray-600 hover:bg-gray-800'}`}
                          title={cfg.enabled ? 'Disable' : 'Enable'}
                        >
                          {cfg.enabled ? <PlayCircle size={14} /> : <Pause size={14} />}
                        </button>
                        <button
                          onClick={() => removeConfig(cfg.id)}
                          className="p-1.5 rounded text-gray-600 hover:text-red-400 hover:bg-red-500/10"
                          title="Remove"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'test' && (
            <div className="flex-1 overflow-y-auto p-5">
              <h3 className="text-sm font-semibold text-gray-200 mb-2">Test the detector</h3>
              <p className="text-xs text-gray-500 mb-3">
                Paste a message to see what the agent would detect, reproduce, and diagnose. No Slack message will be posted.
              </p>
              <textarea
                value={testText}
                onChange={e => setTestText(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-xs text-gray-100 mb-2"
              />
              <div className="flex items-center gap-3 mb-3">
                <label className="flex items-center gap-1.5 text-xs text-gray-400">
                  Sensitivity:
                  <select
                    value={testSensitivity}
                    onChange={e => setTestSensitivity(e.target.value as 'low' | 'medium' | 'high')}
                    className="px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </label>
                <button
                  onClick={runTest}
                  disabled={testing || !testText.trim()}
                  className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-semibold rounded flex items-center gap-1"
                >
                  {testing ? <RefreshCw size={12} className="animate-spin" /> : <Bot size={12} />}
                  Run agent
                </button>
              </div>

              {testResult ? (
                <div className="border border-gray-800 rounded p-3 bg-gray-800/30">
                  <IssueDetail issue={testResult} onAct={act} />
                </div>
              ) : testing ? null : (
                <p className="text-xs text-gray-500 italic">Result will appear here.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- Empty-state for the Activity Feed.
 * Replaces the old two-line 'No issues detected yet / Select an issue' pair
 * which left the user with no idea what an 'issue' was or how one got created.
 *
 * Reads as a specimen plate in the laboratory direction: mono leader rule,
 * a clear explanation, and two inline CTAs that point the user at the two
 * paths that actually create issues — Slack channel monitoring or the
 * Test Detection tab.
 * ------------------------------------------------------------------- */

function EmptyFeed({
  onOpenTest,
  onOpenConfig,
  slackConfigured,
}: {
  onOpenTest: () => void;
  onOpenConfig: () => void;
  slackConfigured: boolean;
}) {
  return (
    <div className="flex-1 overflow-y-auto" style={{ background: 'var(--color-surface)' }}>
      <div className="max-w-[600px] mx-auto px-8 py-14">
        {/* Lab plate */}
        <div
          style={{
            border: '1px solid var(--color-border-strong)',
            borderRadius: 8,
            background: 'var(--color-bg)',
            padding: '28px 28px 24px',
            position: 'relative',
          }}
        >
          {/* Eyebrow */}
          <div
            className="font-mono"
            style={{
              fontSize: 10.5,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: 'var(--color-text-muted)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              marginBottom: 18,
            }}
          >
            <span style={{ color: 'var(--color-accent)' }}>00</span>
            <span aria-hidden style={{ width: 28, height: 1, background: 'var(--color-border-strong)' }} />
            Empty · activity feed
          </div>

          <h3
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 28,
              lineHeight: 1.1,
              letterSpacing: '-0.02em',
              fontWeight: 600,
              color: 'var(--color-text)',
              margin: 0,
              marginBottom: 14,
            }}
          >
            No specimens yet.
          </h3>

          <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--color-text-muted)', margin: 0, marginBottom: 6 }}>
            An <strong style={{ color: 'var(--color-text)' }}>issue</strong> is an API
            failure the agent has caught and is ready to investigate. The agent files
            them automatically — you don't create them by hand.
          </p>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--color-text-muted)', margin: 0, marginBottom: 22 }}>
            Today there are two ways an issue gets filed:
          </p>

          {/* Numbered list — lab forms style */}
          <ol style={{ listStyle: 'none', padding: 0, margin: 0, marginBottom: 24 }}>
            <li
              style={{
                display: 'grid',
                gridTemplateColumns: '34px 1fr',
                gap: 14,
                padding: '14px 0',
                borderTop: '1px solid var(--color-border)',
                alignItems: 'baseline',
              }}
            >
              <span
                className="font-mono"
                style={{ fontSize: 11, letterSpacing: '0.18em', color: 'var(--color-accent)' }}
              >
                01
              </span>
              <div>
                <div style={{ fontSize: 14, color: 'var(--color-text)', fontWeight: 500, marginBottom: 4 }}>
                  The Slack bot spots an API-error message.
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--color-text-muted)', lineHeight: 1.55 }}>
                  When someone posts "/v1/orders is throwing 500s" in a monitored channel,
                  the bot files it here as a specimen.
                </div>
              </div>
            </li>
            <li
              style={{
                display: 'grid',
                gridTemplateColumns: '34px 1fr',
                gap: 14,
                padding: '14px 0',
                borderTop: '1px solid var(--color-border)',
                alignItems: 'baseline',
              }}
            >
              <span
                className="font-mono"
                style={{ fontSize: 11, letterSpacing: '0.18em', color: 'var(--color-accent)' }}
              >
                02
              </span>
              <div>
                <div style={{ fontSize: 14, color: 'var(--color-text)', fontWeight: 500, marginBottom: 4 }}>
                  You paste a sample error into Test Detection.
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--color-text-muted)', lineHeight: 1.55 }}>
                  Drop a message in the Test Detection tab and watch the agent run the
                  detection + diagnosis loop end-to-end. Good first run.
                </div>
              </div>
            </li>
          </ol>

          {/* CTAs */}
          <div className="flex flex-wrap items-center gap-2" style={{ borderTop: '1px solid var(--color-border)', paddingTop: 18 }}>
            <button
              onClick={onOpenTest}
              className="inline-flex items-center gap-2"
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--color-accent-ink)',
                background: 'var(--color-accent)',
                padding: '9px 14px',
                borderRadius: 5,
                cursor: 'pointer',
              }}
            >
              Try test detection
              <span aria-hidden style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>→</span>
            </button>
            <button
              onClick={onOpenConfig}
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: 'var(--color-text)',
                background: 'transparent',
                border: '1px solid var(--color-border-strong)',
                padding: '8px 14px',
                borderRadius: 5,
                cursor: 'pointer',
              }}
            >
              {slackConfigured ? 'Review Slack channels' : 'Configure Slack channels'}
            </button>
          </div>

          <div
            className="font-mono"
            style={{
              marginTop: 18,
              fontSize: 10.5,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--color-text-subtle)',
            }}
          >
            First time? Skip Slack — start with test detection.
          </div>
        </div>
      </div>
    </div>
  );
}

function Badge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded ${ok ? 'text-green-400 bg-green-500/10' : 'text-gray-500 bg-gray-700/30'}`}>
      {ok ? '●' : '○'} {label}
    </span>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
        active ? 'text-purple-400 border-purple-500' : 'text-gray-500 border-transparent hover:text-gray-300'
      }`}
    >
      {children}
    </button>
  );
}

function IssueDetail({ issue, onAct }: { issue: AgentIssue; onAct: (id: string, a: 'approve' | 'ignore' | 'snooze' | 'open-pr') => void }) {
  return (
    <div className="space-y-3 text-xs">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded ${STATUS_COLORS[issue.status] || 'text-gray-400'}`}>{issue.status}</span>
          {issue.method && <span className="font-mono font-bold text-purple-400">{issue.method}</span>}
          {issue.endpoint && <span className="font-mono text-gray-300 truncate">{issue.endpoint}</span>}
          {issue.error_code && <span className="font-mono text-red-400">{issue.error_code}</span>}
        </div>
        <div className="text-gray-400 italic border-l-2 border-gray-700 pl-2">{issue.message_text}</div>
      </div>

      {issue.diagnosis && (
        <div className="bg-gray-800/40 border border-gray-800 rounded p-3">
          <div className="flex items-center gap-2 mb-1.5">
            <AlertTriangle size={12} className="text-yellow-400" />
            <span className="font-semibold text-gray-200">Diagnosis</span>
            {issue.diagnosis.severity && (
              <span className="text-[10px] text-gray-500">({issue.diagnosis.severity})</span>
            )}
          </div>
          <p className="text-gray-300 mb-2">{issue.diagnosis.summary}</p>
          {issue.diagnosis.likelyCause && (
            <p className="text-gray-500 text-[11px]">Likely cause: {issue.diagnosis.likelyCause}</p>
          )}
          {issue.diagnosis.fixes?.length ? (
            <ul className="mt-2 space-y-1">
              {issue.diagnosis.fixes.slice(0, 4).map((f, i) => (
                <li key={i} className="pl-3 border-l border-purple-500/40">
                  <div className="text-gray-200 font-medium">{f.title}</div>
                  <div className="text-gray-500 text-[11px]">{f.detail}</div>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      )}

      {issue.test_result && (
        <div className={`flex items-center gap-2 px-3 py-2 rounded text-[11px] ${
          issue.test_result.success ? 'bg-green-500/10 text-green-300' : 'bg-yellow-500/10 text-yellow-300'
        }`}>
          {issue.test_result.success ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
          Fix test → status {issue.test_result.status} in {issue.test_result.time}ms
        </div>
      )}

      {issue.fix?.pr_url && (
        <a href={issue.fix.pr_url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-cyan-400 hover:underline">
          <GitPullRequest size={12} /> {issue.fix.pr_url}
        </a>
      )}

      <div className="flex items-center gap-2 pt-2 border-t border-gray-800">
        <button onClick={() => onAct(issue.id, 'approve')} className="px-2.5 py-1 bg-green-600/20 hover:bg-green-600/30 text-green-400 rounded text-[11px] font-medium flex items-center gap-1">
          <CheckCircle2 size={12} /> Apply Fix
        </button>
        <button onClick={() => onAct(issue.id, 'open-pr')} className="px-2.5 py-1 bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-400 rounded text-[11px] font-medium flex items-center gap-1">
          <GitPullRequest size={12} /> Open PR
        </button>
        <button onClick={() => onAct(issue.id, 'snooze')} className="px-2.5 py-1 bg-orange-600/20 hover:bg-orange-600/30 text-orange-400 rounded text-[11px] font-medium flex items-center gap-1">
          <Clock size={12} /> Snooze
        </button>
        <button onClick={() => onAct(issue.id, 'ignore')} className="px-2.5 py-1 bg-gray-600/20 hover:bg-gray-600/30 text-gray-400 rounded text-[11px] font-medium flex items-center gap-1">
          <Power size={12} /> Ignore
        </button>
      </div>
    </div>
  );
}
