import { useState, useCallback } from 'react';
import { useApp } from '../store/AppContext';
import type { RequestConfig } from '../types';
import { formatTime } from '../utils/helpers';
import {
  X, Play, Square, BarChart3, Loader2, Zap
} from 'lucide-react';

interface BenchmarkResult {
  iteration: number;
  status: number;
  time: number;
  error?: string;
}

interface Props {
  request: RequestConfig;
  onClose: () => void;
}

function percentile(sorted: number[], p: number): number {
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

export default function PerformanceBenchmark({ request, onClose }: Props) {
  const { getEnvVariables } = useApp();
  const [iterations, setIterations] = useState(20);
  const [concurrency, setConcurrency] = useState(1);
  const [results, setResults] = useState<BenchmarkResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);

  const runBenchmark = useCallback(async () => {
    setIsRunning(true);
    setResults([]);
    setProgress(0);

    const vars = getEnvVariables();
    const resolveVars = (s: string) => s.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? `{{${k}}}`);

    const url = resolveVars(request.url);
    const headers: Record<string, string> = {};
    request.headers.filter(h => h.enabled && h.key).forEach(h => {
      headers[resolveVars(h.key)] = resolveVars(h.value);
    });

    let body: string | undefined;
    if (!['GET', 'HEAD'].includes(request.method) && request.body.type === 'json' && request.body.content) {
      headers['Content-Type'] = headers['Content-Type'] || 'application/json';
      body = resolveVars(request.body.content);
    }

    const runOne = async (i: number): Promise<BenchmarkResult> => {
      const start = performance.now();
      try {
        const res = await fetch(url, { method: request.method, headers, body });
        await res.text(); // consume body
        return { iteration: i, status: res.status, time: performance.now() - start };
      } catch (err) {
        return { iteration: i, status: 0, time: performance.now() - start, error: err instanceof Error ? err.message : 'Error' };
      }
    };

    // Run with concurrency
    const allResults: BenchmarkResult[] = [];
    for (let batch = 0; batch < iterations; batch += concurrency) {
      const batchSize = Math.min(concurrency, iterations - batch);
      const batchResults = await Promise.all(
        Array.from({ length: batchSize }, (_, j) => runOne(batch + j))
      );
      allResults.push(...batchResults);
      setResults([...allResults]);
      setProgress(allResults.length);
    }

    setIsRunning(false);
  }, [request, iterations, concurrency, getEnvVariables]);

  const times = results.map(r => r.time).sort((a, b) => a - b);
  const successCount = results.filter(r => r.status > 0 && r.status < 500).length;
  const errorCount = results.filter(r => r.status === 0 || r.status >= 500).length;
  const avg = times.length > 0 ? times.reduce((s, t) => s + t, 0) / times.length : 0;
  const min = times.length > 0 ? times[0] : 0;
  const max = times.length > 0 ? times[times.length - 1] : 0;
  const p50 = times.length > 0 ? percentile(times, 50) : 0;
  const p95 = times.length > 0 ? percentile(times, 95) : 0;
  const p99 = times.length > 0 ? percentile(times, 99) : 0;
  const maxTime = max || 1;

  // Build histogram buckets
  const BUCKETS = 20;
  const bucketSize = maxTime / BUCKETS;
  const histogram = Array(BUCKETS).fill(0);
  times.forEach(t => {
    const bucket = Math.min(Math.floor(t / bucketSize), BUCKETS - 1);
    histogram[bucket]++;
  });
  const maxBucket = Math.max(...histogram, 1);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-[650px] max-w-[92vw] max-h-[85vh] flex flex-col animate-slide-in" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <Zap size={16} className="text-amber-400" />
            <h2 className="text-sm font-semibold text-gray-200">Performance Benchmark</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-500 hover:text-gray-300"><X size={16} /></button>
        </div>

        {/* Request info */}
        <div className="px-5 py-2 border-b border-gray-800 flex items-center gap-2">
          <span className={`font-mono font-bold text-[10px] method-${request.method.toLowerCase()}`}>{request.method}</span>
          <span className="text-xs text-gray-400 font-mono truncate">{request.url}</span>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-800">
          {!isRunning ? (
            <button onClick={runBenchmark}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-600 text-white text-xs font-semibold hover:bg-amber-500 shadow-lg shadow-amber-600/20">
              <Play size={14} /> Run {iterations}x
            </button>
          ) : (
            <button onClick={() => setIsRunning(false)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-600 text-white text-xs font-semibold">
              <Square size={14} /> Stop
            </button>
          )}
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <span>Iterations:</span>
            <input type="number" value={iterations} onChange={e => setIterations(Math.max(1, parseInt(e.target.value) || 20))}
              className="w-14 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-300 text-center font-mono" disabled={isRunning} />
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <span>Concurrency:</span>
            <input type="number" value={concurrency} onChange={e => setConcurrency(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
              className="w-12 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-300 text-center font-mono" disabled={isRunning} />
          </div>
          {isRunning && (
            <div className="flex items-center gap-1.5 text-xs text-gray-500 ml-auto">
              <Loader2 size={12} className="animate-spin text-amber-400" />
              {progress}/{iterations}
            </div>
          )}
        </div>

        {/* Progress bar */}
        {isRunning && (
          <div className="h-1 bg-gray-800">
            <div className="h-full bg-amber-500 transition-all" style={{ width: `${(progress / iterations) * 100}%` }} />
          </div>
        )}

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-5">
          {results.length === 0 ? (
            <div className="text-center py-12">
              <BarChart3 size={28} className="mx-auto text-gray-700 mb-3" />
              <p className="text-sm text-gray-500">Run the benchmark to see performance metrics</p>
              <p className="text-[10px] text-gray-600 mt-1">Sends the same request {iterations} times and measures latency distribution</p>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Stats grid */}
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: 'Avg', value: formatTime(avg), color: 'text-gray-200' },
                  { label: 'Min', value: formatTime(min), color: 'text-green-400' },
                  { label: 'Max', value: formatTime(max), color: 'text-red-400' },
                  { label: 'Success', value: `${successCount}/${results.length}`, color: errorCount > 0 ? 'text-amber-400' : 'text-green-400' },
                ].map(s => (
                  <div key={s.label} className="p-3 rounded-lg bg-gray-800/30 border border-gray-800 text-center">
                    <p className={`text-lg font-mono font-bold ${s.color}`}>{s.value}</p>
                    <p className="text-[9px] text-gray-600 uppercase tracking-wider mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Percentiles */}
              <div className="flex items-center justify-center gap-6 p-3 rounded-lg bg-gray-800/20 border border-gray-800">
                {[
                  { label: 'p50', value: p50 },
                  { label: 'p95', value: p95 },
                  { label: 'p99', value: p99 },
                ].map(p => (
                  <div key={p.label} className="text-center">
                    <p className="text-xs font-mono font-bold text-brand-400">{formatTime(p.value)}</p>
                    <p className="text-[9px] text-gray-600 uppercase">{p.label}</p>
                  </div>
                ))}
              </div>

              {/* Histogram */}
              <div>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-2">Latency Distribution</p>
                <div className="flex items-end gap-px h-24 p-2 rounded-lg bg-gray-800/20 border border-gray-800">
                  {histogram.map((count, i) => {
                    const height = Math.max(2, (count / maxBucket) * 88);
                    const bucketStart = i * bucketSize;
                    const isP95Bucket = bucketStart <= p95 && bucketStart + bucketSize > p95;
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center justify-end" title={`${formatTime(bucketStart)}-${formatTime(bucketStart + bucketSize)}: ${count} requests`}>
                        <div
                          className={`w-full rounded-t transition-all ${isP95Bucket ? 'bg-red-500/80' : 'bg-brand-500/60'}`}
                          style={{ height }}
                        />
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between mt-1 text-[8px] text-gray-600 font-mono">
                  <span>{formatTime(0)}</span>
                  <span>{formatTime(maxTime / 2)}</span>
                  <span>{formatTime(maxTime)}</span>
                </div>
              </div>

              {/* Individual results scatter */}
              <div>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-2">Individual Requests</p>
                <div className="flex items-end gap-px h-16 p-2 rounded-lg bg-gray-800/20 border border-gray-800">
                  {results.map((r, i) => {
                    const height = Math.max(2, (r.time / maxTime) * 56);
                    return (
                      <div key={i} className="flex-1 flex justify-center items-end"
                        title={`#${r.iteration + 1}: ${formatTime(r.time)} — ${r.status || 'Error'}`}>
                        <div
                          className={`w-full max-w-[8px] rounded-t ${
                            r.status === 0 || r.status >= 500 ? 'bg-red-500/80' :
                            r.time > p95 ? 'bg-amber-500/80' : 'bg-green-500/60'
                          }`}
                          style={{ height }}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
