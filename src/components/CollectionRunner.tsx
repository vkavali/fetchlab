import { useState, useCallback } from 'react';
import type { Collection, RequestConfig, ResponseData } from '../types';
import { useApp } from '../store/AppContext';
import {
  Play, Square, CheckCircle2, XCircle, Loader2, Clock,
  X, ChevronDown, ChevronRight, BarChart3
} from 'lucide-react';
import { formatTime, getStatusClass } from '../utils/helpers';

interface RunResult {
  request: RequestConfig;
  response: ResponseData | null;
  status: 'pending' | 'running' | 'pass' | 'fail' | 'error';
  duration: number;
}

interface Props {
  collection: Collection;
  onClose: () => void;
}

export default function CollectionRunner({ collection, onClose }: Props) {
  const { getEnvVariables } = useApp();
  const [results, setResults] = useState<RunResult[]>(
    collection.requests.map(r => ({ request: r, response: null, status: 'pending', duration: 0 }))
  );
  const [isRunning, setIsRunning] = useState(false);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [delayMs, setDelayMs] = useState(200);

  const passCount = results.filter(r => r.status === 'pass').length;
  const failCount = results.filter(r => r.status === 'fail' || r.status === 'error').length;
  const totalTime = results.reduce((s, r) => s + r.duration, 0);

  const runAll = useCallback(async () => {
    setIsRunning(true);
    const vars = getEnvVariables();
    const resolveVars = (s: string) => s.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? `{{${k}}}`);

    for (let i = 0; i < collection.requests.length; i++) {
      setResults(prev => prev.map((r, idx) => idx === i ? { ...r, status: 'running' } : r));

      const req = collection.requests[i];
      let url = resolveVars(req.url);
      const enabledParams = req.params.filter(p => p.enabled && p.key);
      if (enabledParams.length > 0) {
        const sp = new URLSearchParams();
        enabledParams.forEach(p => sp.set(resolveVars(p.key), resolveVars(p.value)));
        url += (url.includes('?') ? '&' : '?') + sp.toString();
      }

      const headers: Record<string, string> = {};
      req.headers.filter(h => h.enabled && h.key).forEach(h => {
        headers[resolveVars(h.key)] = resolveVars(h.value);
      });

      if (req.auth.type === 'bearer' && req.auth.bearer?.token) {
        headers['Authorization'] = `Bearer ${resolveVars(req.auth.bearer.token)}`;
      }

      let body: string | undefined;
      if (!['GET', 'HEAD'].includes(req.method) && req.body.type === 'json' && req.body.content) {
        headers['Content-Type'] = headers['Content-Type'] || 'application/json';
        body = resolveVars(req.body.content);
      }

      const start = performance.now();
      try {
        const res = await fetch(url, { method: req.method, headers, body });
        const elapsed = performance.now() - start;
        const text = await res.text();
        const resHeaders: Record<string, string> = {};
        res.headers.forEach((v, k) => { resHeaders[k] = v; });

        const response: ResponseData = {
          status: res.status,
          statusText: res.statusText,
          headers: resHeaders,
          body: text,
          size: new Blob([text]).size,
          time: elapsed,
          contentType: res.headers.get('content-type') || '',
        };

        setResults(prev => prev.map((r, idx) =>
          idx === i ? {
            ...r,
            response,
            status: res.ok ? 'pass' : 'fail',
            duration: elapsed,
          } : r
        ));
      } catch (err) {
        const elapsed = performance.now() - start;
        setResults(prev => prev.map((r, idx) =>
          idx === i ? {
            ...r,
            response: {
              status: 0, statusText: 'Error', headers: {},
              body: err instanceof Error ? err.message : 'Unknown error',
              size: 0, time: elapsed, contentType: 'text/plain',
            },
            status: 'error',
            duration: elapsed,
          } : r
        ));
      }

      // Delay between requests
      if (i < collection.requests.length - 1 && delayMs > 0) {
        await new Promise(r => setTimeout(r, delayMs));
      }
    }
    setIsRunning(false);
  }, [collection, getEnvVariables, delayMs]);

  const stopRun = () => {
    setIsRunning(false);
  };

  const allDone = results.every(r => r.status !== 'pending' && r.status !== 'running');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-[650px] max-w-[90vw] max-h-[80vh] flex flex-col animate-slide-in"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800">
          <div>
            <h2 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
              <BarChart3 size={16} className="text-brand-400" />
              Collection Runner
            </h2>
            <p className="text-[11px] text-gray-500 mt-0.5">{collection.name} — {collection.requests.length} requests</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-500 hover:text-gray-300 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-800">
          {!isRunning ? (
            <button
              onClick={runAll}
              disabled={isRunning}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand-600 text-white text-xs font-semibold hover:bg-brand-500 transition-colors shadow-lg shadow-brand-600/20"
            >
              <Play size={14} />
              {allDone ? 'Run Again' : 'Run All'}
            </button>
          ) : (
            <button
              onClick={stopRun}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-500 transition-colors"
            >
              <Square size={14} />
              Stop
            </button>
          )}

          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <span>Delay:</span>
            <input
              type="number"
              value={delayMs}
              onChange={e => setDelayMs(Math.max(0, parseInt(e.target.value) || 0))}
              className="w-16 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-300 text-center font-mono focus:outline-none"
              disabled={isRunning}
            />
            <span>ms</span>
          </div>

          <div className="flex-1" />

          {/* Summary stats */}
          {allDone && (
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1 text-green-400">
                <CheckCircle2 size={12} /> {passCount}
              </span>
              <span className="flex items-center gap-1 text-red-400">
                <XCircle size={12} /> {failCount}
              </span>
              <span className="flex items-center gap-1 text-gray-500">
                <Clock size={12} /> {formatTime(totalTime)}
              </span>
            </div>
          )}
        </div>

        {/* Progress bar */}
        {isRunning && (
          <div className="h-1 bg-gray-800">
            <div
              className="h-full bg-brand-500 transition-all duration-300"
              style={{
                width: `${(results.filter(r => r.status !== 'pending' && r.status !== 'running').length / results.length) * 100}%`
              }}
            />
          </div>
        )}

        {/* Results list */}
        <div className="flex-1 overflow-y-auto">
          {results.map((result, idx) => (
            <div key={result.request.id + idx} className="border-b border-gray-800/50">
              <button
                onClick={() => setExpandedIdx(expandedIdx === idx ? null : idx)}
                className="flex items-center gap-3 w-full px-5 py-2.5 text-left hover:bg-gray-800/30 transition-colors"
              >
                {/* Status icon */}
                {result.status === 'pending' && <div className="w-4 h-4 rounded-full border-2 border-gray-700 flex-shrink-0" />}
                {result.status === 'running' && <Loader2 size={16} className="text-brand-400 animate-spin flex-shrink-0" />}
                {result.status === 'pass' && <CheckCircle2 size={16} className="text-green-400 flex-shrink-0" />}
                {result.status === 'fail' && <XCircle size={16} className="text-amber-400 flex-shrink-0" />}
                {result.status === 'error' && <XCircle size={16} className="text-red-400 flex-shrink-0" />}

                <span className={`font-mono font-bold text-[10px] w-10 method-${result.request.method.toLowerCase()}`}>
                  {result.request.method}
                </span>
                <span className="flex-1 text-sm text-gray-300 truncate">
                  {result.request.name || result.request.url}
                </span>

                {result.response && (
                  <>
                    <span className={`font-mono text-xs font-semibold ${getStatusClass(result.response.status)}`}>
                      {result.response.status}
                    </span>
                    <span className="text-[10px] text-gray-600 font-mono w-16 text-right">
                      {formatTime(result.duration)}
                    </span>
                  </>
                )}

                {result.response && (
                  expandedIdx === idx
                    ? <ChevronDown size={14} className="text-gray-600 flex-shrink-0" />
                    : <ChevronRight size={14} className="text-gray-600 flex-shrink-0" />
                )}
              </button>

              {/* Expanded response preview */}
              {expandedIdx === idx && result.response && (
                <div className="px-5 pb-3 animate-slide-in">
                  <pre className="p-3 rounded-lg bg-gray-800/50 border border-gray-800 text-[11px] font-mono text-gray-400 max-h-[200px] overflow-auto whitespace-pre-wrap break-all">
                    {(() => {
                      try {
                        return JSON.stringify(JSON.parse(result.response.body), null, 2);
                      } catch {
                        return result.response.body.substring(0, 1000);
                      }
                    })()}
                  </pre>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
