import { useState, useCallback, useRef, useEffect } from 'react';
import { useApp } from '../store/AppContext';
import {
  Activity, Play, Square, RefreshCw,
  TrendingUp, TrendingDown, Minus, X, Wifi, WifiOff
} from 'lucide-react';
import { formatTime, getStatusClass } from '../utils/helpers';

interface EndpointHealth {
  url: string;
  method: string;
  name: string;
  checks: { status: number; time: number; timestamp: number; error?: string }[];
  isChecking: boolean;
}

export default function HealthDashboard({ onClose }: { onClose: () => void }) {
  const { state } = useApp();
  const [endpoints, setEndpoints] = useState<EndpointHealth[]>(() => {
    // Auto-populate from collections
    const eps: EndpointHealth[] = [];
    const seen = new Set<string>();
    state.collections.forEach(col => {
      col.requests.forEach(req => {
        const key = `${req.method}:${req.url}`;
        if (!seen.has(key) && req.url) {
          seen.add(key);
          eps.push({ url: req.url, method: req.method, name: req.name, checks: [], isChecking: false });
        }
      });
    });
    return eps;
  });
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [intervalSec, setIntervalSec] = useState(30);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkEndpoint = useCallback(async (idx: number) => {
    setEndpoints(prev => prev.map((ep, i) => i === idx ? { ...ep, isChecking: true } : ep));

    const ep = endpoints[idx];
    const start = performance.now();
    try {
      const res = await fetch(ep.url, { method: ep.method, signal: AbortSignal.timeout(10000) });
      const elapsed = performance.now() - start;
      setEndpoints(prev => prev.map((e, i) =>
        i === idx ? {
          ...e,
          isChecking: false,
          checks: [...e.checks, { status: res.status, time: elapsed, timestamp: Date.now() }].slice(-50),
        } : e
      ));
    } catch (err) {
      const elapsed = performance.now() - start;
      setEndpoints(prev => prev.map((e, i) =>
        i === idx ? {
          ...e,
          isChecking: false,
          checks: [...e.checks, { status: 0, time: elapsed, timestamp: Date.now(), error: err instanceof Error ? err.message : 'Error' }].slice(-50),
        } : e
      ));
    }
  }, [endpoints]);

  const checkAll = useCallback(async () => {
    for (let i = 0; i < endpoints.length; i++) {
      await checkEndpoint(i);
    }
  }, [endpoints, checkEndpoint]);

  const toggleMonitoring = () => {
    if (isMonitoring) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
      setIsMonitoring(false);
    } else {
      checkAll();
      intervalRef.current = setInterval(checkAll, intervalSec * 1000);
      setIsMonitoring(true);
    }
  };

  useEffect(() => {
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  const getLastStatus = (ep: EndpointHealth) => ep.checks.length > 0 ? ep.checks[ep.checks.length - 1] : null;
  const getAvgTime = (ep: EndpointHealth) => {
    if (ep.checks.length === 0) return 0;
    return ep.checks.reduce((s, c) => s + c.time, 0) / ep.checks.length;
  };
  const getUptime = (ep: EndpointHealth) => {
    if (ep.checks.length === 0) return 100;
    const up = ep.checks.filter(c => c.status > 0 && c.status < 500).length;
    return Math.round((up / ep.checks.length) * 100);
  };
  const getTrend = (ep: EndpointHealth) => {
    if (ep.checks.length < 2) return 'stable';
    const recent = ep.checks.slice(-3);
    const older = ep.checks.slice(-6, -3);
    if (older.length === 0) return 'stable';
    const recentAvg = recent.reduce((s, c) => s + c.time, 0) / recent.length;
    const olderAvg = older.reduce((s, c) => s + c.time, 0) / older.length;
    if (recentAvg > olderAvg * 1.3) return 'slower';
    if (recentAvg < olderAvg * 0.7) return 'faster';
    return 'stable';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-[800px] max-w-[92vw] max-h-[85vh] flex flex-col animate-slide-in" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <Activity size={16} className="text-green-400" />
            <h2 className="text-sm font-semibold text-gray-200">API Health Dashboard</h2>
            {isMonitoring && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 text-[9px] font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                LIVE
              </span>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-500 hover:text-gray-300"><X size={16} /></button>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-800">
          <button onClick={toggleMonitoring}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
              isMonitoring
                ? 'bg-red-600 text-white hover:bg-red-500'
                : 'bg-green-600 text-white hover:bg-green-500'
            }`}>
            {isMonitoring ? <><Square size={14} /> Stop</> : <><Play size={14} /> Monitor</>}
          </button>
          <button onClick={checkAll} disabled={isMonitoring}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gray-800 text-gray-300 text-xs font-medium hover:bg-gray-700 disabled:opacity-50 transition-colors border border-gray-700">
            <RefreshCw size={14} /> Check All Now
          </button>
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <span>Interval:</span>
            <input type="number" value={intervalSec} onChange={e => setIntervalSec(Math.max(5, parseInt(e.target.value) || 30))}
              className="w-14 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-300 text-center font-mono" disabled={isMonitoring} />
            <span>sec</span>
          </div>
          <div className="flex-1" />
          <span className="text-[10px] text-gray-600">{endpoints.length} endpoints</span>
        </div>

        {/* Endpoint list */}
        <div className="flex-1 overflow-y-auto">
          {endpoints.length === 0 ? (
            <div className="text-center py-12">
              <Activity size={28} className="mx-auto text-gray-700 mb-3" />
              <p className="text-sm text-gray-500">No endpoints to monitor</p>
              <p className="text-xs text-gray-600 mt-1">Add requests to your collections first</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-800/50">
              {endpoints.map((ep, idx) => {
                const last = getLastStatus(ep);
                const avg = getAvgTime(ep);
                const uptime = getUptime(ep);
                const trend = getTrend(ep);

                return (
                  <div key={idx} className="px-5 py-3 hover:bg-gray-800/20 transition-colors">
                    <div className="flex items-center gap-3">
                      {/* Status indicator */}
                      {ep.isChecking ? (
                        <RefreshCw size={16} className="text-brand-400 animate-spin flex-shrink-0" />
                      ) : !last ? (
                        <div className="w-4 h-4 rounded-full border-2 border-gray-700 flex-shrink-0" />
                      ) : last.status > 0 && last.status < 500 ? (
                        <Wifi size={16} className="text-green-400 flex-shrink-0" />
                      ) : (
                        <WifiOff size={16} className="text-red-400 flex-shrink-0" />
                      )}

                      {/* Method + URL */}
                      <span className={`font-mono font-bold text-[10px] w-10 flex-shrink-0 method-${ep.method.toLowerCase()}`}>
                        {ep.method}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-200 truncate">{ep.name}</p>
                        <p className="text-[10px] text-gray-600 font-mono truncate">{ep.url}</p>
                      </div>

                      {/* Stats */}
                      {last && (
                        <div className="flex items-center gap-4 flex-shrink-0">
                          <div className="text-center">
                            <p className={`text-xs font-mono font-bold ${getStatusClass(last.status)}`}>{last.status || 'ERR'}</p>
                            <p className="text-[8px] text-gray-600">STATUS</p>
                          </div>
                          <div className="text-center">
                            <p className="text-xs font-mono text-gray-300">{formatTime(avg)}</p>
                            <p className="text-[8px] text-gray-600">AVG</p>
                          </div>
                          <div className="text-center">
                            <p className={`text-xs font-mono font-bold ${uptime >= 99 ? 'text-green-400' : uptime >= 90 ? 'text-amber-400' : 'text-red-400'}`}>
                              {uptime}%
                            </p>
                            <p className="text-[8px] text-gray-600">UPTIME</p>
                          </div>
                          <div className="flex items-center gap-0.5">
                            {trend === 'faster' && <TrendingDown size={12} className="text-green-400" />}
                            {trend === 'slower' && <TrendingUp size={12} className="text-red-400" />}
                            {trend === 'stable' && <Minus size={12} className="text-gray-600" />}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Mini sparkline of response times */}
                    {ep.checks.length > 1 && (
                      <div className="flex items-end gap-px mt-2 ml-7 h-6">
                        {ep.checks.slice(-30).map((check, i) => {
                          const maxTime = Math.max(...ep.checks.slice(-30).map(c => c.time), 1);
                          const height = Math.max(2, (check.time / maxTime) * 24);
                          return (
                            <div
                              key={i}
                              className={`w-1.5 rounded-t transition-all ${
                                check.status > 0 && check.status < 400 ? 'bg-green-500/60' :
                                check.status >= 400 && check.status < 500 ? 'bg-amber-500/60' :
                                'bg-red-500/60'
                              }`}
                              style={{ height }}
                              title={`${formatTime(check.time)} — ${check.status}`}
                            />
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
