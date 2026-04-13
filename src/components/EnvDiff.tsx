import { useState, useCallback } from 'react';
import { useApp } from '../store/AppContext';
import type { RequestConfig } from '../types';
import { formatTime, formatBytes } from '../utils/helpers';
import { computeJsonDiff, diffSummary } from '../utils/jsonDiff';
import {
  X, GitCompare, Play, Loader2, Plus, Minus, RefreshCw, CheckCircle2
} from 'lucide-react';

interface EnvResult {
  envName: string;
  url: string;
  status: number;
  statusText: string;
  time: number;
  size: number;
  body: string;
  error?: string;
}

interface Props {
  request: RequestConfig;
  onClose: () => void;
}

export default function EnvDiff({ request, onClose }: Props) {
  const { state } = useApp();
  const [leftEnvId, setLeftEnvId] = useState(state.environments[0]?.id || '');
  const [rightEnvId, setRightEnvId] = useState(state.environments[1]?.id || state.environments[0]?.id || '');
  const [leftResult, setLeftResult] = useState<EnvResult | null>(null);
  const [rightResult, setRightResult] = useState<EnvResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const resolveUrl = (envId: string) => {
    const env = state.environments.find(e => e.id === envId);
    if (!env) return request.url;
    let url = request.url;
    env.variables.filter(v => v.enabled && v.key).forEach(v => {
      url = url.replace(new RegExp(`\\{\\{${v.key}\\}\\}`, 'g'), v.value);
    });
    return url;
  };

  const runOne = async (envId: string): Promise<EnvResult> => {
    const env = state.environments.find(e => e.id === envId);
    const url = resolveUrl(envId);
    const headers: Record<string, string> = {};
    request.headers.filter(h => h.enabled && h.key).forEach(h => {
      let val = h.value;
      if (env) env.variables.filter(v => v.enabled).forEach(v => { val = val.replace(new RegExp(`\\{\\{${v.key}\\}\\}`, 'g'), v.value); });
      headers[h.key] = val;
    });

    const start = performance.now();
    try {
      const res = await fetch(url, { method: request.method, headers });
      const elapsed = performance.now() - start;
      const body = await res.text();
      return { envName: env?.name || 'Unknown', url, status: res.status, statusText: res.statusText, time: elapsed, size: new Blob([body]).size, body };
    } catch (err) {
      return { envName: env?.name || 'Unknown', url, status: 0, statusText: 'Error', time: performance.now() - start, size: 0, body: '', error: err instanceof Error ? err.message : 'Failed' };
    }
  };

  const runComparison = useCallback(async () => {
    setIsRunning(true);
    setLeftResult(null);
    setRightResult(null);
    const [left, right] = await Promise.all([runOne(leftEnvId), runOne(rightEnvId)]);
    setLeftResult(left);
    setRightResult(right);
    setIsRunning(false);
  }, [leftEnvId, rightEnvId]);

  let diffEntries: ReturnType<typeof computeJsonDiff> = [];
  let summary = { added: 0, removed: 0, changed: 0, total: 0 };
  if (leftResult && rightResult) {
    try {
      const leftJson = JSON.parse(leftResult.body);
      const rightJson = JSON.parse(rightResult.body);
      diffEntries = computeJsonDiff(leftJson, rightJson);
      summary = diffSummary(diffEntries);
    } catch { /* non-JSON */ }
  }
  const changes = diffEntries.filter(e => e.type !== 'unchanged');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-[750px] max-w-[92vw] max-h-[85vh] flex flex-col animate-slide-in" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <GitCompare size={16} className="text-cyan-400" />
            <h2 className="text-sm font-semibold text-gray-200">Environment Diff</h2>
            <span className="text-[10px] text-gray-500">Same request, different environments</span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-500 hover:text-gray-300"><X size={16} /></button>
        </div>

        {/* Env selectors */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-800">
          <div className="flex-1">
            <label className="text-[9px] text-gray-600 uppercase tracking-wider font-semibold">Left</label>
            <select value={leftEnvId} onChange={e => setLeftEnvId(e.target.value)}
              className="mt-0.5 w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-gray-300" disabled={isRunning}>
              {state.environments.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
          <div className="pt-4">
            <span className="text-gray-600 text-xs">vs</span>
          </div>
          <div className="flex-1">
            <label className="text-[9px] text-gray-600 uppercase tracking-wider font-semibold">Right</label>
            <select value={rightEnvId} onChange={e => setRightEnvId(e.target.value)}
              className="mt-0.5 w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-gray-300" disabled={isRunning}>
              {state.environments.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
          <div className="pt-4">
            <button onClick={runComparison} disabled={isRunning}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-cyan-600 text-white text-xs font-semibold hover:bg-cyan-500 disabled:opacity-50 shadow-lg shadow-cyan-600/20">
              {isRunning ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
              Compare
            </button>
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto">
          {!leftResult && !rightResult && !isRunning && (
            <div className="text-center py-12">
              <GitCompare size={28} className="mx-auto text-gray-700 mb-3" />
              <p className="text-sm text-gray-500">Select two environments and click Compare</p>
              <p className="text-[10px] text-gray-600 mt-1">See how the same API behaves in dev vs staging vs prod</p>
            </div>
          )}

          {leftResult && rightResult && (
            <div className="p-5 space-y-4">
              {/* Side-by-side stats */}
              <div className="grid grid-cols-2 gap-3">
                {[leftResult, rightResult].map((r, i) => (
                  <div key={i} className={`p-3 rounded-lg border ${r.status > 0 && r.status < 400 ? 'bg-green-500/5 border-green-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
                    <p className="text-xs font-medium text-gray-300 mb-2">{r.envName}</p>
                    <p className="text-[10px] text-gray-500 font-mono truncate mb-2">{r.url}</p>
                    <div className="flex items-center gap-3 text-xs">
                      <span className={`font-mono font-bold ${r.status < 400 ? 'text-green-400' : 'text-red-400'}`}>{r.status || 'ERR'}</span>
                      <span className="text-gray-500">{formatTime(r.time)}</span>
                      <span className="text-gray-600">{formatBytes(r.size)}</span>
                    </div>
                    {r.error && <p className="text-[10px] text-red-400 mt-1">{r.error}</p>}
                  </div>
                ))}
              </div>

              {/* Diff summary */}
              {summary.total > 0 ? (
                <div className="flex items-center gap-3 p-2 rounded-lg bg-gray-800/30 border border-gray-800">
                  <span className="text-xs text-gray-400 font-medium">Response diff:</span>
                  <span className="flex items-center gap-0.5 text-xs text-green-400"><Plus size={10} />{summary.added}</span>
                  <span className="flex items-center gap-0.5 text-xs text-red-400"><Minus size={10} />{summary.removed}</span>
                  <span className="flex items-center gap-0.5 text-xs text-amber-400"><RefreshCw size={10} />{summary.changed}</span>
                </div>
              ) : changes.length === 0 && (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-green-500/10 border border-green-500/20">
                  <CheckCircle2 size={14} className="text-green-400" />
                  <span className="text-xs text-green-400 font-medium">Responses are identical across environments</span>
                </div>
              )}

              {/* Diff entries */}
              {changes.length > 0 && (
                <div className="space-y-1">
                  {changes.slice(0, 50).map((entry, i) => (
                    <div key={i} className={`flex items-start gap-3 px-3 py-2 rounded text-xs font-mono ${
                      entry.type === 'added' ? 'bg-green-500/5 text-green-400' :
                      entry.type === 'removed' ? 'bg-red-500/5 text-red-400' :
                      'bg-amber-500/5 text-amber-400'
                    }`}>
                      <span className="w-4 text-center font-bold">{entry.type === 'added' ? '+' : entry.type === 'removed' ? '−' : '~'}</span>
                      <span className="text-gray-500 min-w-[100px]">{entry.path}</span>
                      <span className="flex-1 break-all">
                        {entry.type === 'changed' && <><span className="text-red-400/60 line-through">{JSON.stringify(entry.oldValue)}</span> → <span className="text-green-400">{JSON.stringify(entry.newValue)}</span></>}
                        {entry.type === 'added' && JSON.stringify(entry.newValue)}
                        {entry.type === 'removed' && JSON.stringify(entry.oldValue)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
