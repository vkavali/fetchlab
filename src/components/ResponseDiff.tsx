import { useState, useEffect } from 'react';
import { useApp } from '../store/AppContext';
import type { ResponseData } from '../types';
import { computeJsonDiff, diffSummary, type DiffEntry } from '../utils/jsonDiff';
import { X, GitCompare, Plus, Minus, RefreshCw, Sparkles, Loader2, AlertTriangle, ShieldCheck } from 'lucide-react';
import { aiPost, getAiStatus, type AiDiffExplanation } from '../utils/aiClient';

interface Props {
  currentResponse: ResponseData;
  onClose: () => void;
}

export default function ResponseDiff({ currentResponse, onClose }: Props) {
  const { state } = useApp();
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string | null>(
    state.snapshots.length > 0 ? state.snapshots[0].id : null
  );

  const snapshot = state.snapshots.find(s => s.id === selectedSnapshotId);

  let leftJson: unknown = null;
  let rightJson: unknown = null;
  let entries: DiffEntry[] = [];

  if (snapshot) {
    try { leftJson = JSON.parse(snapshot.response.body); } catch { leftJson = snapshot.response.body; }
    try { rightJson = JSON.parse(currentResponse.body); } catch { rightJson = currentResponse.body; }
    entries = computeJsonDiff(leftJson, rightJson);
  }

  const summary = diffSummary(entries);
  const changes = entries.filter(e => e.type !== 'unchanged');

  const [aiExplanation, setAiExplanation] = useState<AiDiffExplanation | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiEnabled, setAiEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    getAiStatus().then(s => setAiEnabled(s.enabled));
  }, []);

  // Reset whenever the user picks a different snapshot to compare
  useEffect(() => {
    setAiExplanation(null);
    setAiError(null);
  }, [selectedSnapshotId]);

  const explainDiff = async () => {
    if (changes.length === 0) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const result = await aiPost<AiDiffExplanation>('/api/ai/explain-diff', {
        leftLabel: snapshot?.name || 'snapshot',
        rightLabel: 'current response',
        changes: changes.map(c => ({
          type: c.type,
          path: c.path,
          oldValue: c.oldValue,
          newValue: c.newValue,
        })),
      });
      setAiExplanation(result);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'AI explanation failed');
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-[750px] max-w-[90vw] max-h-[80vh] flex flex-col animate-slide-in" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <GitCompare size={16} className="text-brand-400" />
            <h2 className="text-sm font-semibold text-gray-200">Response Diff</h2>
            {snapshot && (
              <div className="flex items-center gap-2 ml-3 text-xs text-gray-500">
                <span className="flex items-center gap-0.5 text-green-400"><Plus size={10} />{summary.added}</span>
                <span className="flex items-center gap-0.5 text-red-400"><Minus size={10} />{summary.removed}</span>
                <span className="flex items-center gap-0.5 text-amber-400"><RefreshCw size={10} />{summary.changed}</span>
              </div>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-500 hover:text-gray-300"><X size={16} /></button>
        </div>

        {/* Snapshot selector */}
        <div className="px-5 py-2 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Compare with:</span>
            <select
              value={selectedSnapshotId || ''}
              onChange={e => setSelectedSnapshotId(e.target.value || null)}
              className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-300 focus:outline-none flex-1"
            >
              {state.snapshots.length === 0 && <option value="">No snapshots saved</option>}
              {state.snapshots.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} — {s.requestMethod} {s.requestUrl.substring(0, 50)} ({new Date(s.timestamp).toLocaleString()})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* AI explanation controls */}
        {snapshot && changes.length > 0 && (
          <div className="px-5 py-2 border-b border-gray-800 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">AI explanation</p>
              <button
                onClick={explainDiff}
                disabled={aiLoading || aiEnabled === false}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold text-purple-300 bg-gradient-to-r from-purple-500/15 to-pink-500/15 ring-1 ring-purple-500/30 hover:text-white hover:from-purple-500 hover:to-pink-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                title={aiEnabled === false ? 'Set ANTHROPIC_API_KEY on the server to enable' : 'Explain this diff'}
              >
                {aiLoading ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
                {aiLoading ? 'Analyzing…' : aiExplanation ? 'Re-analyze' : 'Explain in plain English'}
              </button>
            </div>
            {aiEnabled === false && (
              <p className="text-[10px] text-amber-400/80 flex items-center gap-1">
                <AlertTriangle size={10} /> AI explanations require <code className="font-mono">ANTHROPIC_API_KEY</code> on the server.
              </p>
            )}
            {aiError && (
              <p className="text-[11px] text-red-400 flex items-center gap-1">
                <AlertTriangle size={10} /> {aiError}
              </p>
            )}
            {aiExplanation && (
              <div className={`rounded-lg border p-3 space-y-2 ${
                aiExplanation.breaking
                  ? 'bg-red-500/5 border-red-500/30'
                  : 'bg-green-500/5 border-green-500/20'
              }`}>
                <div className="flex items-start gap-2">
                  {aiExplanation.breaking
                    ? <AlertTriangle size={14} className="text-red-400 mt-0.5 flex-shrink-0" />
                    : <ShieldCheck size={14} className="text-green-400 mt-0.5 flex-shrink-0" />
                  }
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-semibold uppercase tracking-wider ${
                        aiExplanation.breaking ? 'text-red-400' : 'text-green-400'
                      }`}>
                        {aiExplanation.breaking ? 'Breaking change' : 'Non-breaking'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-200 mt-1 leading-relaxed">{aiExplanation.summary}</p>
                    {aiExplanation.breaking && aiExplanation.breakingReason && (
                      <p className="text-[11px] text-red-300/80 mt-1.5 italic">{aiExplanation.breakingReason}</p>
                    )}
                  </div>
                </div>
                {aiExplanation.highlights && aiExplanation.highlights.length > 0 && (
                  <ul className="space-y-1 ml-6 mt-2">
                    {aiExplanation.highlights.map((h, i) => (
                      <li key={i} className="text-[11px] text-gray-300">
                        <span className="text-gray-100 font-medium">{h.change}</span>
                        {h.impact && <span className="text-gray-500"> — {h.impact}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}

        {/* Diff content */}
        <div className="flex-1 overflow-y-auto p-4">
          {!snapshot ? (
            <div className="text-center py-8">
              <GitCompare size={24} className="mx-auto text-gray-700 mb-2" />
              <p className="text-xs text-gray-500">Save a response snapshot first, then compare</p>
            </div>
          ) : changes.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-green-400 font-medium">No differences found</p>
              <p className="text-xs text-gray-500 mt-1">The responses are identical</p>
            </div>
          ) : (
            <div className="space-y-1">
              {changes.map((entry, i) => (
                <div key={i} className={`flex items-start gap-3 px-3 py-2 rounded-lg text-xs font-mono ${
                  entry.type === 'added' ? 'bg-green-500/10 border border-green-500/20' :
                  entry.type === 'removed' ? 'bg-red-500/10 border border-red-500/20' :
                  'bg-amber-500/10 border border-amber-500/20'
                }`}>
                  <span className={`flex-shrink-0 w-5 text-center font-bold ${
                    entry.type === 'added' ? 'text-green-400' : entry.type === 'removed' ? 'text-red-400' : 'text-amber-400'
                  }`}>
                    {entry.type === 'added' ? '+' : entry.type === 'removed' ? '−' : '~'}
                  </span>
                  <span className="text-gray-400 flex-shrink-0 min-w-[120px]">{entry.path}</span>
                  <div className="flex-1 min-w-0">
                    {entry.type === 'changed' && (
                      <>
                        <div className="text-red-400/70 line-through break-all">{JSON.stringify(entry.oldValue)}</div>
                        <div className="text-green-400 break-all">{JSON.stringify(entry.newValue)}</div>
                      </>
                    )}
                    {entry.type === 'added' && <span className="text-green-400 break-all">{JSON.stringify(entry.newValue)}</span>}
                    {entry.type === 'removed' && <span className="text-red-400 break-all">{JSON.stringify(entry.oldValue)}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
