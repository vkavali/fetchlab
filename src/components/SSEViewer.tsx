import { useState, useRef, useEffect, useCallback } from 'react';
import {
  X, Radio, Play, Pause, Trash2, Search, Copy, Check,
  Wifi, WifiOff, Clock, ArrowDown, Zap
} from 'lucide-react';

interface SSEEvent {
  id: string;
  eventType: string;
  data: string;
  eventId?: string;
  timestamp: number;
}

export default function SSEViewer({ onClose }: { onClose: () => void }) {
  const [url, setUrl] = useState('');
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [events, setEvents] = useState<SSEEvent[]>([]);
  const [autoScroll, setAutoScroll] = useState(true);
  const [paused, setPaused] = useState(false);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [rawMode, setRawMode] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'eventsource' | 'fetch'>('eventsource');
  const [customHeaders, setCustomHeaders] = useState<{ key: string; value: string }[]>([]);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [eventsPerSec, setEventsPerSec] = useState(0);

  const eventSourceRef = useRef<EventSource | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const eventCountRef = useRef(0);
  const idCounter = useRef(0);

  useEffect(() => {
    if (autoScroll && logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [events, autoScroll]);

  useEffect(() => {
    if (!startTime) return;
    const iv = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000;
      if (elapsed > 0) setEventsPerSec(Math.round((eventCountRef.current / elapsed) * 10) / 10);
    }, 1000);
    return () => clearInterval(iv);
  }, [startTime]);

  const addEvent = useCallback((evt: Omit<SSEEvent, 'id' | 'timestamp'>) => {
    if (paused) return;
    idCounter.current++;
    eventCountRef.current++;
    setEvents(prev => [...prev.slice(-500), { ...evt, id: String(idCounter.current), timestamp: Date.now() }]);
  }, [paused]);

  const connect = useCallback(() => {
    if (!url) return;
    setConnecting(true);
    setError(null);
    setEvents([]);
    eventCountRef.current = 0;
    setStartTime(Date.now());

    if (mode === 'eventsource') {
      const es = new EventSource(url);
      eventSourceRef.current = es;
      es.onopen = () => { setConnected(true); setConnecting(false); };
      es.onmessage = (e) => {
        addEvent({ eventType: 'message', data: e.data, eventId: e.lastEventId || undefined });
      };
      es.onerror = () => {
        if (es.readyState === EventSource.CLOSED) {
          setConnected(false);
          setConnecting(false);
          setError('Connection closed by server');
        }
      };
    } else {
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      const headers: Record<string, string> = { 'Accept': 'text/event-stream' };
      customHeaders.forEach(h => { if (h.key) headers[h.key] = h.value; });

      fetch(url, { headers, signal: ctrl.signal })
        .then(async (res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          setConnected(true);
          setConnecting(false);
          const reader = res.body?.getReader();
          if (!reader) throw new Error('No readable stream');
          const decoder = new TextDecoder();
          let buffer = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const parts = buffer.split('\n\n');
            buffer = parts.pop() || '';

            for (const part of parts) {
              if (!part.trim()) continue;
              let eventType = 'message';
              let data = '';
              let eventId: string | undefined;

              for (const line of part.split('\n')) {
                if (line.startsWith('event:')) eventType = line.slice(6).trim();
                else if (line.startsWith('data:')) data += (data ? '\n' : '') + line.slice(5).trim();
                else if (line.startsWith('id:')) eventId = line.slice(3).trim();
              }
              if (data) addEvent({ eventType, data, eventId });
            }
          }
          setConnected(false);
        })
        .catch((err) => {
          if (err.name !== 'AbortError') setError(err.message);
          setConnected(false);
          setConnecting(false);
        });
    }
  }, [url, mode, customHeaders, addEvent]);

  const disconnect = useCallback(() => {
    eventSourceRef.current?.close();
    eventSourceRef.current = null;
    abortRef.current?.abort();
    abortRef.current = null;
    setConnected(false);
    setConnecting(false);
    setStartTime(null);
  }, []);

  useEffect(() => () => disconnect(), [disconnect]);

  const copyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 1500);
  };

  const eventTypes = [...new Set(events.map(e => e.eventType))];
  const filtered = events.filter(e => {
    if (filterType && e.eventType !== filterType) return false;
    if (search && !e.data.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const totalSize = events.reduce((s, e) => s + e.data.length, 0);
  const elapsed = startTime ? Math.floor((Date.now() - startTime) / 1000) : 0;

  const formatJson = (s: string) => {
    try { return JSON.stringify(JSON.parse(s), null, 2); } catch { return s; }
  };

  const eventColor = (type: string) => {
    if (type === 'message') return 'text-blue-400 bg-blue-500/10';
    if (type === 'error') return 'text-red-400 bg-red-500/10';
    return 'text-purple-400 bg-purple-500/10';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col animate-slide-in">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <Radio size={16} className="text-orange-400" />
            <h2 className="text-sm font-bold text-gray-200">SSE / Event Stream Viewer</h2>
            <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-orange-500/20 text-orange-400 uppercase">Live</span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Connection Bar */}
        <div className="px-5 py-3 border-b border-gray-800 space-y-2">
          <div className="flex items-center gap-2">
            <div className="flex gap-1 bg-gray-800/50 rounded-lg p-0.5">
              <button onClick={() => setMode('eventsource')} className={`px-2 py-1 rounded text-[10px] font-medium ${mode === 'eventsource' ? 'bg-orange-500/20 text-orange-400' : 'text-gray-500'}`}>
                EventSource
              </button>
              <button onClick={() => setMode('fetch')} className={`px-2 py-1 rounded text-[10px] font-medium ${mode === 'fetch' ? 'bg-orange-500/20 text-orange-400' : 'text-gray-500'}`}>
                Fetch Stream
              </button>
            </div>
            <input
              value={url}
              onChange={e => setUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !connected && connect()}
              placeholder="https://api.example.com/events"
              className="flex-1 bg-gray-800/50 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 font-mono placeholder-gray-600 focus:outline-none focus:border-orange-500/50"
            />
            {!connected ? (
              <button
                onClick={connect}
                disabled={!url || connecting}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-orange-600 text-white text-sm font-semibold hover:bg-orange-500 disabled:opacity-50 transition-colors"
              >
                {connecting ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Wifi size={14} />}
                Connect
              </button>
            ) : (
              <button
                onClick={disconnect}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-500 transition-colors"
              >
                <WifiOff size={14} />
                Disconnect
              </button>
            )}
          </div>

          {mode === 'fetch' && (
            <div className="space-y-1">
              <p className="text-[10px] text-gray-500 uppercase font-semibold">Custom Headers</p>
              {customHeaders.map((h, i) => (
                <div key={i} className="flex gap-2">
                  <input value={h.key} onChange={e => setCustomHeaders(prev => prev.map((x, j) => j === i ? { ...x, key: e.target.value } : x))}
                    placeholder="Header" className="flex-1 bg-gray-800/30 border border-gray-800 rounded px-2 py-1 text-xs font-mono text-gray-300 focus:outline-none" />
                  <input value={h.value} onChange={e => setCustomHeaders(prev => prev.map((x, j) => j === i ? { ...x, value: e.target.value } : x))}
                    placeholder="Value" className="flex-1 bg-gray-800/30 border border-gray-800 rounded px-2 py-1 text-xs font-mono text-gray-300 focus:outline-none" />
                  <button onClick={() => setCustomHeaders(prev => prev.filter((_, j) => j !== i))} className="text-gray-600 hover:text-red-400"><X size={12} /></button>
                </div>
              ))}
              <button onClick={() => setCustomHeaders(prev => [...prev, { key: '', value: '' }])} className="text-[10px] text-gray-500 hover:text-orange-400">+ Add header</button>
            </div>
          )}
        </div>

        {/* Stats Bar */}
        <div className="flex items-center gap-4 px-5 py-2 border-b border-gray-800 bg-gray-900/50 text-[11px]">
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400 animate-pulse' : 'bg-gray-600'}`} />
            <span className={connected ? 'text-green-400' : 'text-gray-500'}>{connected ? 'Connected' : connecting ? 'Connecting...' : 'Disconnected'}</span>
          </div>
          <div className="flex items-center gap-1 text-gray-500"><Zap size={10} /><span>{events.length} events</span></div>
          <div className="flex items-center gap-1 text-gray-500"><Clock size={10} /><span>{elapsed}s</span></div>
          <div className="text-gray-500">{eventsPerSec} evt/s</div>
          <div className="text-gray-500">{(totalSize / 1024).toFixed(1)} KB</div>

          <div className="flex-1" />

          <div className="flex items-center gap-2">
            {eventTypes.length > 0 && (
              <select value={filterType} onChange={e => setFilterType(e.target.value)} className="bg-gray-800 border border-gray-700 rounded px-1.5 py-0.5 text-[10px] text-gray-400">
                <option value="">All types</option>
                {eventTypes.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            )}
            <div className="flex items-center gap-1 bg-gray-800/50 rounded px-1.5 py-0.5">
              <Search size={10} className="text-gray-600" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Filter..."
                className="bg-transparent text-[10px] text-gray-300 w-20 focus:outline-none" />
            </div>
            <button onClick={() => setRawMode(!rawMode)} className={`px-1.5 py-0.5 rounded text-[10px] ${rawMode ? 'bg-orange-500/20 text-orange-400' : 'text-gray-500 hover:text-gray-300'}`}>
              Raw
            </button>
            <button onClick={() => setPaused(!paused)} className={`p-1 rounded ${paused ? 'text-amber-400' : 'text-gray-500 hover:text-gray-300'}`} title={paused ? 'Resume' : 'Pause'}>
              {paused ? <Play size={12} /> : <Pause size={12} />}
            </button>
            <button onClick={() => setAutoScroll(!autoScroll)} className={`p-1 rounded ${autoScroll ? 'text-orange-400' : 'text-gray-500'}`} title="Auto-scroll">
              <ArrowDown size={12} />
            </button>
            <button onClick={() => { setEvents([]); eventCountRef.current = 0; }} className="p-1 rounded text-gray-500 hover:text-red-400" title="Clear">
              <Trash2 size={12} />
            </button>
          </div>
        </div>

        {/* Events */}
        <div ref={logRef} className="flex-1 overflow-y-auto p-3 space-y-1 min-h-0" style={{ maxHeight: 'calc(90vh - 240px)' }}>
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
              <WifiOff size={14} />
              {error}
            </div>
          )}

          {filtered.length === 0 && !error && (
            <div className="flex flex-col items-center justify-center py-16 text-gray-600">
              <Radio size={32} className="mb-3 opacity-50" />
              <p className="text-sm">{connected ? 'Waiting for events...' : 'Connect to an SSE endpoint to start streaming'}</p>
              <p className="text-xs mt-1 text-gray-700">Supports AI streaming APIs (OpenAI, Anthropic, etc.)</p>
            </div>
          )}

          {filtered.map(evt => (
            <div key={evt.id} className="group flex gap-2 p-2 rounded-lg hover:bg-gray-800/30 transition-colors">
              <div className="flex flex-col items-center gap-1 flex-shrink-0 pt-0.5">
                <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${eventColor(evt.eventType)}`}>
                  {evt.eventType}
                </span>
                <span className="text-[9px] text-gray-700 font-mono">
                  {new Date(evt.timestamp).toLocaleTimeString(undefined, { hour12: false, fractionalSecondDigits: 1 } as Intl.DateTimeFormatOptions)}
                </span>
                {evt.eventId && <span className="text-[8px] text-gray-700">id:{evt.eventId}</span>}
              </div>
              <div className="flex-1 min-w-0">
                {rawMode ? (
                  <pre className="text-xs font-mono text-gray-400 whitespace-pre-wrap break-all">{evt.data}</pre>
                ) : (
                  <pre className="text-xs font-mono text-gray-300 whitespace-pre-wrap break-all leading-relaxed">{formatJson(evt.data)}</pre>
                )}
              </div>
              <button
                onClick={() => copyText(evt.data, evt.id)}
                className="p-1 rounded opacity-0 group-hover:opacity-100 text-gray-600 hover:text-gray-300 transition-all flex-shrink-0"
              >
                {copied === evt.id ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
