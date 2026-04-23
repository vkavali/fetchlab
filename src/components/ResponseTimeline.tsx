import { useMemo } from 'react';
import type { ResponseData } from '../types';
import { Clock, Server, Shield, FileDown, Wifi } from 'lucide-react';

interface TimelineSegment {
  label: string;
  duration: number;
  color: string;
  icon: typeof Clock;
}

export default function ResponseTimeline({ response }: { response: ResponseData }) {
  const segments = useMemo(() => {
    const total = response.time;
    const size = response.size;
    const isHttps = true;

    const downloadRate = size > 0 ? Math.max(size / (total * 0.3), 1000) : 5000;
    const downloadTime = size > 0 ? Math.min((size / downloadRate), total * 0.3) : total * 0.05;

    const remaining = total - downloadTime;

    let dns: number, connect: number, tls: number, ttfb: number;
    if (total < 50) {
      dns = remaining * 0.05;
      connect = remaining * 0.1;
      tls = isHttps ? remaining * 0.15 : 0;
      ttfb = remaining - dns - connect - tls;
    } else if (total < 200) {
      dns = Math.min(remaining * 0.1, 15);
      connect = Math.min(remaining * 0.12, 20);
      tls = isHttps ? Math.min(remaining * 0.18, 30) : 0;
      ttfb = remaining - dns - connect - tls;
    } else {
      dns = Math.min(remaining * 0.08, 30);
      connect = Math.min(remaining * 0.1, 40);
      tls = isHttps ? Math.min(remaining * 0.15, 60) : 0;
      ttfb = remaining - dns - connect - tls;
    }

    const result: TimelineSegment[] = [
      { label: 'DNS Lookup', duration: Math.max(dns, 0.1), color: 'bg-emerald-500', icon: Wifi },
      { label: 'TCP Connect', duration: Math.max(connect, 0.1), color: 'bg-blue-500', icon: Server },
    ];

    if (isHttps) {
      result.push({ label: 'TLS Handshake', duration: Math.max(tls, 0.1), color: 'bg-purple-500', icon: Shield });
    }

    result.push(
      { label: 'Time to First Byte', duration: Math.max(ttfb, 0.1), color: 'bg-amber-500', icon: Clock },
      { label: 'Content Download', duration: Math.max(downloadTime, 0.1), color: 'bg-cyan-500', icon: FileDown },
    );

    return result;
  }, [response]);

  const total = response.time;

  return (
    <div className="p-4 space-y-4">
      <div className="space-y-1">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Request Timing Breakdown</h3>
        <p className="text-[10px] text-gray-600">Estimated phase breakdown based on response characteristics</p>
      </div>

      {/* Waterfall bars */}
      <div className="space-y-2">
        {segments.map((seg, i) => {
          const pct = (seg.duration / total) * 100;
          const offset = segments.slice(0, i).reduce((s, x) => s + (x.duration / total) * 100, 0);
          return (
            <div key={seg.label} className="group">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 w-36 flex-shrink-0">
                  <seg.icon size={11} className="text-gray-500" />
                  <span className="text-[11px] text-gray-400">{seg.label}</span>
                </div>
                <div className="flex-1 h-6 bg-gray-800/50 rounded-md overflow-hidden relative">
                  <div
                    className={`absolute top-0 h-full ${seg.color} rounded-md transition-all duration-500 opacity-80 group-hover:opacity-100`}
                    style={{ left: `${offset}%`, width: `${Math.max(pct, 1)}%` }}
                  />
                </div>
                <span className="text-[11px] font-mono text-gray-500 w-16 text-right">
                  {seg.duration < 1 ? '<1' : Math.round(seg.duration)} ms
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Stacked bar */}
      <div className="space-y-1.5">
        <p className="text-[10px] text-gray-500 uppercase font-semibold">Waterfall</p>
        <div className="h-8 flex rounded-lg overflow-hidden">
          {segments.map((seg) => {
            const pct = (seg.duration / total) * 100;
            return (
              <div
                key={seg.label}
                className={`${seg.color} opacity-80 hover:opacity-100 transition-opacity relative group/bar`}
                style={{ width: `${Math.max(pct, 0.5)}%` }}
                title={`${seg.label}: ${Math.round(seg.duration)}ms`}
              >
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 rounded bg-gray-800 border border-gray-700 text-[9px] text-gray-300 whitespace-nowrap opacity-0 group-hover/bar:opacity-100 transition-opacity pointer-events-none z-10">
                  {seg.label}: {Math.round(seg.duration)}ms ({Math.round(pct)}%)
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex justify-between text-[9px] font-mono text-gray-600">
          <span>0 ms</span>
          <span>{Math.round(total)} ms</span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 pt-2">
        {segments.map(seg => (
          <div key={seg.label} className="flex items-center gap-1.5">
            <div className={`w-2.5 h-2.5 rounded-sm ${seg.color}`} />
            <span className="text-[10px] text-gray-500">{seg.label}</span>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3 pt-2">
        <div className="p-3 rounded-lg bg-gray-800/30 border border-gray-800">
          <p className="text-[10px] text-gray-600 uppercase font-semibold">Total Time</p>
          <p className="text-lg font-mono font-bold text-gray-200">{Math.round(total)}<span className="text-xs text-gray-500 ml-0.5">ms</span></p>
        </div>
        <div className="p-3 rounded-lg bg-gray-800/30 border border-gray-800">
          <p className="text-[10px] text-gray-600 uppercase font-semibold">Response Size</p>
          <p className="text-lg font-mono font-bold text-gray-200">
            {response.size > 1024 ? `${(response.size / 1024).toFixed(1)}` : response.size}
            <span className="text-xs text-gray-500 ml-0.5">{response.size > 1024 ? 'KB' : 'B'}</span>
          </p>
        </div>
        <div className="p-3 rounded-lg bg-gray-800/30 border border-gray-800">
          <p className="text-[10px] text-gray-600 uppercase font-semibold">Throughput</p>
          <p className="text-lg font-mono font-bold text-gray-200">
            {total > 0 ? ((response.size / 1024) / (total / 1000)).toFixed(1) : '0'}
            <span className="text-xs text-gray-500 ml-0.5">KB/s</span>
          </p>
        </div>
      </div>
    </div>
  );
}
