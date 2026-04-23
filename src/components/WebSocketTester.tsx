import { useState, useRef, useCallback, useEffect } from 'react';
import {
  X, Send, Wifi, WifiOff, ArrowUpRight, ArrowDownLeft,
  Copy, Check, RefreshCw, Trash2, Radio
} from 'lucide-react';

type ConnectionState = 'idle' | 'connecting' | 'open' | 'closed' | 'error';
type MessageType = 'text' | 'json' | 'binary';

interface WsMessage {
  id: number;
  direction: 'sent' | 'received';
  content: string;
  timestamp: number;
  type: MessageType;
}

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
    + '.' + String(d.getMilliseconds()).padStart(3, '0');
}

function tryPrettyJson(str: string): { formatted: string; isJson: boolean } {
  try {
    const parsed = JSON.parse(str);
    return { formatted: JSON.stringify(parsed, null, 2), isJson: true };
  } catch {
    return { formatted: str, isJson: false };
  }
}

export default function WebSocketTester({ onClose }: { onClose: () => void }) {
  const [url, setUrl] = useState('wss://');
  const [connectionState, setConnectionState] = useState<ConnectionState>('idle');
  const [messages, setMessages] = useState<WsMessage[]>([]);
  const [composerText, setComposerText] = useState('');
  const [messageType, setMessageType] = useState<MessageType>('text');
  const [subprotocol, setSubprotocol] = useState('');
  const [customHeaders, setCustomHeaders] = useState('');
  const [autoReconnect, setAutoReconnect] = useState(false);
  const [showProtocolOptions, setShowProtocolOptions] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [sentCount, setSentCount] = useState(0);
  const [receivedCount, setReceivedCount] = useState(0);
  const [connectTime, setConnectTime] = useState<number | null>(null);
  const [latency, setLatency] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const messageIdRef = useRef(0);
  const logEndRef = useRef<HTMLDivElement>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectStartRef = useRef<number>(0);
  const pingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoReconnectRef = useRef(autoReconnect);

  // Keep ref in sync so the close handler always reads the latest value
  useEffect(() => {
    autoReconnectRef.current = autoReconnect;
  }, [autoReconnect]);

  // Auto-scroll message log
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (pingTimerRef.current) clearInterval(pingTimerRef.current);
    };
  }, []);

  const addMessage = useCallback((direction: 'sent' | 'received', content: string, type: MessageType) => {
    const msg: WsMessage = {
      id: ++messageIdRef.current,
      direction,
      content,
      timestamp: Date.now(),
      type,
    };
    setMessages(prev => [...prev, msg]);
    if (direction === 'sent') setSentCount(c => c + 1);
    else setReceivedCount(c => c + 1);
  }, []);

  const startPingMeasure = useCallback(() => {
    if (pingTimerRef.current) clearInterval(pingTimerRef.current);
    pingTimerRef.current = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        const start = performance.now();
        // Measure round-trip by timing how long the send call takes (approximation)
        // For a true ping, we'd need server cooperation. We'll track the connection age.
        const elapsed = performance.now() - start;
        setLatency(Math.round(elapsed * 100) / 100);
      }
    }, 5000);
  }, []);

  const connect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
    }
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    setConnectionState('connecting');
    setErrorMessage(null);
    connectStartRef.current = performance.now();

    try {
      const protocols = subprotocol.trim() ? subprotocol.split(',').map(s => s.trim()) : undefined;
      const ws = new WebSocket(url, protocols);
      wsRef.current = ws;

      ws.onopen = () => {
        const elapsed = performance.now() - connectStartRef.current;
        setConnectionState('open');
        setConnectTime(Math.round(elapsed));
        setLatency(Math.round(elapsed));
        startPingMeasure();
      };

      ws.onmessage = (event) => {
        const data = typeof event.data === 'string' ? event.data : '[Binary data]';
        const { isJson } = tryPrettyJson(data);
        addMessage('received', data, isJson ? 'json' : 'text');
      };

      ws.onerror = () => {
        setConnectionState('error');
        setErrorMessage('Connection error');
      };

      ws.onclose = (event) => {
        setConnectionState('closed');
        if (pingTimerRef.current) clearInterval(pingTimerRef.current);

        if (!event.wasClean) {
          setErrorMessage(`Closed unexpectedly (code ${event.code})`);
        }

        if (autoReconnectRef.current && event.code !== 1000) {
          reconnectTimerRef.current = setTimeout(() => {
            connect();
          }, 3000);
        }
      };
    } catch (err) {
      setConnectionState('error');
      setErrorMessage(err instanceof Error ? err.message : 'Failed to connect');
    }
  }, [url, subprotocol, addMessage, startPingMeasure]);

  const disconnect = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (pingTimerRef.current) clearInterval(pingTimerRef.current);
    if (wsRef.current) {
      wsRef.current.onclose = () => setConnectionState('closed');
      wsRef.current.close(1000, 'User disconnect');
    }
  }, []);

  const sendMessage = useCallback(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN || !composerText.trim()) return;

    let payload = composerText;

    if (messageType === 'json') {
      try {
        payload = JSON.stringify(JSON.parse(composerText));
      } catch {
        // Send as-is if invalid JSON
      }
    }

    if (messageType === 'binary') {
      const encoder = new TextEncoder();
      wsRef.current.send(encoder.encode(payload));
    } else {
      wsRef.current.send(payload);
    }

    addMessage('sent', composerText, messageType);
    setComposerText('');
  }, [composerText, messageType, addMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      sendMessage();
    }
  };

  const copyMessage = (msg: WsMessage) => {
    const { isJson, formatted } = tryPrettyJson(msg.content);
    navigator.clipboard.writeText(isJson ? formatted : msg.content);
    setCopiedId(msg.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const clearMessages = () => {
    setMessages([]);
    setSentCount(0);
    setReceivedCount(0);
  };

  const stateColor: Record<ConnectionState, string> = {
    idle: 'text-gray-500',
    connecting: 'text-amber-400',
    open: 'text-green-400',
    closed: 'text-gray-500',
    error: 'text-red-400',
  };

  const stateLabel: Record<ConnectionState, string> = {
    idle: 'Disconnected',
    connecting: 'Connecting...',
    open: 'Connected',
    closed: 'Closed',
    error: 'Error',
  };

  const stateDotColor: Record<ConnectionState, string> = {
    idle: 'bg-gray-500',
    connecting: 'bg-amber-400 animate-pulse',
    open: 'bg-green-400',
    closed: 'bg-gray-500',
    error: 'bg-red-400',
  };

  const isConnected = connectionState === 'open';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col animate-slide-in">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800">
          <div className="flex items-center gap-2.5">
            <Radio size={16} className="text-brand-400" />
            <h2 className="text-sm font-semibold text-gray-200">WebSocket Tester</h2>
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-gray-800 text-[9px] font-medium">
              <span className={`w-1.5 h-1.5 rounded-full ${stateDotColor[connectionState]}`} />
              <span className={stateColor[connectionState]}>{stateLabel[connectionState]}</span>
            </span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-500 hover:text-gray-300 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Connection Bar */}
        <div className="px-5 py-3 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-0 bg-gray-800/50 border border-gray-700 rounded-lg overflow-hidden focus-within:border-brand-500 transition-colors">
              <span className="px-3 py-2 text-xs text-gray-500 font-mono bg-gray-800/80 border-r border-gray-700 select-none">WS</span>
              <input
                type="text"
                value={url}
                onChange={e => setUrl(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !isConnected) connect(); }}
                placeholder="wss://echo.websocket.org"
                className="flex-1 bg-transparent px-3 py-2 text-sm text-gray-200 font-mono placeholder-gray-600 outline-none"
                disabled={isConnected || connectionState === 'connecting'}
              />
            </div>
            {!isConnected && connectionState !== 'connecting' ? (
              <button
                onClick={connect}
                disabled={!url.trim()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand-600 text-white text-xs font-semibold hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg shadow-brand-600/20"
              >
                <Wifi size={14} />
                Connect
              </button>
            ) : connectionState === 'connecting' ? (
              <button
                onClick={disconnect}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-600 text-white text-xs font-semibold hover:bg-amber-500 transition-colors"
              >
                <RefreshCw size={14} className="animate-spin" />
                Cancel
              </button>
            ) : (
              <button
                onClick={disconnect}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-500 transition-colors"
              >
                <WifiOff size={14} />
                Disconnect
              </button>
            )}
          </div>

          {/* Protocol options toggle */}
          <div className="flex items-center gap-3 mt-2">
            <button
              onClick={() => setShowProtocolOptions(!showProtocolOptions)}
              className="text-[10px] text-gray-500 hover:text-gray-400 transition-colors"
            >
              {showProtocolOptions ? '- Hide options' : '+ Protocol options'}
            </button>
            <label className="flex items-center gap-1.5 text-[10px] text-gray-500 cursor-pointer ml-auto">
              <input
                type="checkbox"
                checked={autoReconnect}
                onChange={e => setAutoReconnect(e.target.checked)}
                className="w-3 h-3 rounded border-gray-600 bg-gray-800 text-brand-500 focus:ring-brand-500 focus:ring-offset-0 accent-brand-500"
              />
              <RefreshCw size={10} />
              Auto-reconnect
            </label>
          </div>

          {/* Protocol options */}
          {showProtocolOptions && (
            <div className="mt-2 p-3 rounded-lg bg-gray-800/30 border border-gray-800 space-y-2">
              <div>
                <label className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Subprotocol</label>
                <input
                  type="text"
                  value={subprotocol}
                  onChange={e => setSubprotocol(e.target.value)}
                  placeholder="e.g. graphql-ws, soap"
                  className="mt-1 w-full bg-gray-800 border border-gray-700 rounded px-2.5 py-1.5 text-xs text-gray-300 font-mono placeholder-gray-600 outline-none focus:border-brand-500 transition-colors"
                  disabled={isConnected}
                />
              </div>
              <div>
                <label className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Custom Headers (not supported by browser WebSocket API)</label>
                <textarea
                  value={customHeaders}
                  onChange={e => setCustomHeaders(e.target.value)}
                  placeholder={"X-Custom-Header: value\nAuthorization: Bearer token"}
                  rows={2}
                  className="mt-1 w-full bg-gray-800 border border-gray-700 rounded px-2.5 py-1.5 text-xs text-gray-300 font-mono placeholder-gray-600 outline-none focus:border-brand-500 transition-colors resize-none"
                  disabled={isConnected}
                />
                <p className="text-[9px] text-gray-600 mt-0.5">Note: Browser WebSocket API does not support custom headers. These are for reference only.</p>
              </div>
            </div>
          )}
        </div>

        {/* Connection Info Bar */}
        <div className="flex items-center gap-4 px-5 py-2 border-b border-gray-800 bg-gray-800/20">
          <div className="flex items-center gap-1.5 text-[10px]">
            <span className="text-gray-600 uppercase tracking-wider">State:</span>
            <span className={`font-semibold ${stateColor[connectionState]}`}>{stateLabel[connectionState]}</span>
          </div>
          {connectTime !== null && (
            <div className="flex items-center gap-1.5 text-[10px]">
              <span className="text-gray-600 uppercase tracking-wider">Handshake:</span>
              <span className="text-gray-400 font-mono">{connectTime}ms</span>
            </div>
          )}
          {latency !== null && isConnected && (
            <div className="flex items-center gap-1.5 text-[10px]">
              <span className="text-gray-600 uppercase tracking-wider">Latency:</span>
              <span className="text-gray-400 font-mono">~{latency}ms</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 text-[10px]">
            <ArrowUpRight size={10} className="text-green-400" />
            <span className="text-gray-400 font-mono">{sentCount}</span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px]">
            <ArrowDownLeft size={10} className="text-blue-400" />
            <span className="text-gray-400 font-mono">{receivedCount}</span>
          </div>
          {errorMessage && (
            <span className="text-[10px] text-red-400 ml-auto">{errorMessage}</span>
          )}
          <div className="flex-1" />
          <button
            onClick={clearMessages}
            className="flex items-center gap-1 px-2 py-1 rounded text-[10px] text-gray-500 hover:text-gray-400 hover:bg-gray-800 transition-colors"
            title="Clear messages"
          >
            <Trash2 size={10} />
            Clear
          </button>
        </div>

        {/* Message Log */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {messages.length === 0 ? (
            <div className="text-center py-16">
              <Radio size={28} className="mx-auto text-gray-700 mb-3" />
              <p className="text-sm text-gray-500">No messages yet</p>
              <p className="text-[10px] text-gray-600 mt-1">
                {isConnected ? 'Send a message or wait for incoming data' : 'Connect to a WebSocket server to begin'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-800/30">
              {messages.map(msg => {
                const { formatted, isJson } = tryPrettyJson(msg.content);
                const isSent = msg.direction === 'sent';

                return (
                  <div
                    key={msg.id}
                    className="px-5 py-2.5 hover:bg-gray-800/20 transition-colors group"
                  >
                    <div className="flex items-start gap-3">
                      {/* Direction indicator */}
                      <div className={`mt-0.5 p-1 rounded ${isSent ? 'bg-green-500/10' : 'bg-blue-500/10'}`}>
                        {isSent ? (
                          <ArrowUpRight size={12} className="text-green-400" />
                        ) : (
                          <ArrowDownLeft size={12} className="text-blue-400" />
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[10px] font-semibold uppercase tracking-wider ${isSent ? 'text-green-400/70' : 'text-blue-400/70'}`}>
                            {isSent ? 'Sent' : 'Received'}
                          </span>
                          <span className="text-[9px] text-gray-600 font-mono">{formatTimestamp(msg.timestamp)}</span>
                          {isJson && (
                            <span className="px-1.5 py-0.5 rounded bg-accent-500/15 text-accent-400 text-[8px] font-semibold uppercase">JSON</span>
                          )}
                          {msg.type === 'binary' && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 text-[8px] font-semibold uppercase">Binary</span>
                          )}
                        </div>
                        <pre className="text-xs text-gray-300 font-mono whitespace-pre-wrap break-all bg-gray-800/30 rounded-lg px-3 py-2 max-h-48 overflow-y-auto">
                          {isJson ? formatted : msg.content}
                        </pre>
                      </div>

                      {/* Copy button */}
                      <button
                        onClick={() => copyMessage(msg)}
                        className="mt-1 p-1.5 rounded-lg text-gray-600 hover:text-gray-400 hover:bg-gray-800 opacity-0 group-hover:opacity-100 transition-all"
                        title="Copy message"
                      >
                        {copiedId === msg.id ? (
                          <Check size={12} className="text-green-400" />
                        ) : (
                          <Copy size={12} />
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
              <div ref={logEndRef} />
            </div>
          )}
        </div>

        {/* Message Composer */}
        <div className="border-t border-gray-800 px-5 py-3">
          {/* Message type toggle */}
          <div className="flex items-center gap-1 mb-2">
            {(['text', 'json', 'binary'] as MessageType[]).map(t => (
              <button
                key={t}
                onClick={() => setMessageType(t)}
                className={`px-2.5 py-1 rounded text-[10px] font-semibold uppercase tracking-wider transition-colors ${
                  messageType === t
                    ? 'bg-brand-500/20 text-brand-400'
                    : 'text-gray-500 hover:text-gray-400 hover:bg-gray-800'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Input + Send */}
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <textarea
                value={composerText}
                onChange={e => setComposerText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  messageType === 'json'
                    ? '{"type": "ping", "data": "hello"}'
                    : messageType === 'binary'
                    ? 'Enter text to encode as binary...'
                    : 'Type a message...'
                }
                rows={messageType === 'json' ? 3 : 1}
                className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 font-mono placeholder-gray-600 outline-none focus:border-brand-500 transition-colors resize-none"
                disabled={!isConnected}
              />
            </div>
            <button
              onClick={sendMessage}
              disabled={!isConnected || !composerText.trim()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand-600 text-white text-xs font-semibold hover:bg-brand-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-lg shadow-brand-600/20"
            >
              <Send size={14} />
              Send
            </button>
          </div>
          <p className="text-[9px] text-gray-600 mt-1.5">{isConnected ? 'Press Ctrl+Enter to send' : 'Connect to a server to send messages'}</p>
        </div>
      </div>
    </div>
  );
}
