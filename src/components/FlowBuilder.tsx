import { useState, useRef, useCallback } from 'react';
import type { Collection } from '../types';
import {
  X, Play, Square, Plus, Trash2, ChevronDown, ChevronRight,
  Loader2, CheckCircle, XCircle, Clock, Save,
  Upload, GripVertical
} from 'lucide-react';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface FlowNode {
  id: string;
  name: string;
  method: HttpMethod;
  url: string;
  headers: { key: string; value: string }[];
  body: string;
  extractions: { variableName: string; jsonPath: string }[];
  condition: string;
  delayMs: number;
  status: 'pending' | 'running' | 'success' | 'error' | 'skipped';
  response?: { status: number; statusText: string; body: string; time: number; headers: Record<string, string> };
  error?: string;
}

interface SavedFlow {
  name: string;
  nodes: Omit<FlowNode, 'status' | 'response' | 'error'>[];
}

function extractByPath(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((cur, key) => {
    if (cur && typeof cur === 'object' && key in (cur as Record<string, unknown>)) {
      return (cur as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

const METHOD_COLORS: Record<string, string> = {
  GET: 'text-green-400 bg-green-500/10',
  POST: 'text-blue-400 bg-blue-500/10',
  PUT: 'text-amber-400 bg-amber-500/10',
  PATCH: 'text-purple-400 bg-purple-500/10',
  DELETE: 'text-red-400 bg-red-500/10',
};

function createNode(): FlowNode {
  return {
    id: crypto.randomUUID(),
    name: '',
    method: 'GET',
    url: '',
    headers: [],
    body: '',
    extractions: [],
    condition: '',
    delayMs: 0,
    status: 'pending',
  };
}

export default function FlowBuilder({ onClose, collections }: { onClose: () => void; collections: Collection[] }) {
  const [flowName, setFlowName] = useState('New Flow');
  const [nodes, setNodes] = useState<FlowNode[]>([createNode()]);
  const [expandedNode, setExpandedNode] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [stopOnError, setStopOnError] = useState(true);
  const [totalTime, setTotalTime] = useState<number | null>(null);
  const [savedFlows, setSavedFlows] = useState<SavedFlow[]>(() => {
    try {
      const raw = localStorage.getItem('fetchlab_flows');
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  });
  const [showSaved, setShowSaved] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const abortRef = useRef(false);

  const updateNode = (id: string, updates: Partial<FlowNode>) => {
    setNodes(prev => prev.map(n => n.id === id ? { ...n, ...updates } : n));
  };

  const addNodeAfter = (index: number) => {
    const node = createNode();
    setNodes(prev => [...prev.slice(0, index + 1), node, ...prev.slice(index + 1)]);
    setExpandedNode(node.id);
  };

  const removeNode = (id: string) => {
    setNodes(prev => prev.filter(n => n.id !== id));
  };

  const importFromCollection = (col: Collection) => {
    const imported = col.requests.map(r => ({
      ...createNode(),
      name: r.name,
      method: r.method as HttpMethod,
      url: r.url,
      headers: r.headers.filter(h => h.enabled && h.key).map(h => ({ key: h.key, value: h.value })),
      body: r.body.type === 'json' ? r.body.content : '',
    }));
    setNodes(imported);
    setFlowName(col.name + ' Flow');
    setShowImport(false);
  };

  const saveFlow = () => {
    const flow: SavedFlow = {
      name: flowName,
      nodes: nodes.map(({ status, response, error, ...rest }) => rest),
    };
    const updated = [...savedFlows.filter(f => f.name !== flowName), flow];
    setSavedFlows(updated);
    try { localStorage.setItem('fetchlab_flows', JSON.stringify(updated)); } catch { /* ignore */ }
  };

  const loadFlow = (flow: SavedFlow) => {
    setFlowName(flow.name);
    setNodes(flow.nodes.map(n => ({ ...n, status: 'pending' as const })));
    setShowSaved(false);
  };

  const runFlow = useCallback(async () => {
    setRunning(true);
    abortRef.current = false;
    setTotalTime(null);
    const variables: Record<string, string> = {};
    const startTime = performance.now();

    setNodes(prev => prev.map(n => ({ ...n, status: 'pending' as const, response: undefined, error: undefined })));

    for (let i = 0; i < nodes.length; i++) {
      if (abortRef.current) {
        setNodes(prev => prev.map((n, j) => j >= i ? { ...n, status: 'skipped' } : n));
        break;
      }

      const node = nodes[i];
      setNodes(prev => prev.map((n, j) => j === i ? { ...n, status: 'running' } : n));

      if (node.delayMs > 0) {
        await new Promise(r => setTimeout(r, node.delayMs));
      }

      const resolveVars = (s: string) => s.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (_, path) => {
        const parts = path.split('.');
        if (parts[0].startsWith('step') && parts.length > 1) {
          const stepIdx = parseInt(parts[0].replace('step', '')) - 1;
          if (stepIdx >= 0 && stepIdx < i) {
            const stepNode = nodes[stepIdx];
            if (stepNode.response) {
              try {
                const body = JSON.parse(stepNode.response.body);
                const val = extractByPath(body, parts.slice(1).join('.'));
                if (val !== undefined) return String(val);
              } catch { /* not JSON */ }
            }
          }
          return `{{${path}}}`;
        }
        return variables[path] ?? `{{${path}}}`;
      });

      try {
        const url = resolveVars(node.url);
        const headers: Record<string, string> = {};
        node.headers.forEach(h => { if (h.key) headers[resolveVars(h.key)] = resolveVars(h.value); });

        let body: string | undefined;
        if (!['GET'].includes(node.method) && node.body) {
          headers['Content-Type'] = headers['Content-Type'] || 'application/json';
          body = resolveVars(node.body);
        }

        const t0 = performance.now();
        const res = await fetch(url, { method: node.method, headers, body });
        const time = performance.now() - t0;
        const text = await res.text();
        const resHeaders: Record<string, string> = {};
        res.headers.forEach((v, k) => { resHeaders[k] = v; });

        const response = { status: res.status, statusText: res.statusText, body: text, time, headers: resHeaders };

        for (const ext of node.extractions) {
          if (!ext.variableName || !ext.jsonPath) continue;
          try {
            const parsed = JSON.parse(text);
            const val = extractByPath(parsed, ext.jsonPath);
            if (val !== undefined) variables[ext.variableName] = String(val);
          } catch { /* not JSON */ }
        }

        if (node.condition) {
          const conditionPassed = evaluateCondition(node.condition, response.status);
          if (!conditionPassed) {
            setNodes(prev => prev.map((n, j) => j === i ? { ...n, status: 'error', response, error: `Condition failed: ${node.condition}` } : n));
            if (stopOnError) {
              setNodes(prev => prev.map((n, j) => j > i ? { ...n, status: 'skipped' } : n));
              break;
            }
            continue;
          }
        }

        setNodes(prev => prev.map((n, j) => j === i ? { ...n, status: 'success', response } : n));
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        setNodes(prev => prev.map((n, j) => j === i ? { ...n, status: 'error', error: msg } : n));
        if (stopOnError) {
          setNodes(prev => prev.map((n, j) => j > i ? { ...n, status: 'skipped' } : n));
          break;
        }
      }
    }

    setTotalTime(performance.now() - startTime);
    setRunning(false);
  }, [nodes, stopOnError]);

  const stopFlow = () => { abortRef.current = true; };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-slide-in">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <GripVertical size={16} className="text-cyan-400" />
              <input
                value={flowName}
                onChange={e => setFlowName(e.target.value)}
                className="bg-transparent text-sm font-bold text-gray-200 focus:outline-none border-b border-transparent focus:border-cyan-500/50 w-48"
              />
            </div>
            <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-cyan-500/20 text-cyan-400 uppercase">Flow</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={saveFlow} className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-gray-400 hover:text-gray-200 hover:bg-gray-800" title="Save flow">
              <Save size={12} /> Save
            </button>
            <button onClick={() => setShowSaved(!showSaved)} className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-gray-400 hover:text-gray-200 hover:bg-gray-800" title="Load flow">
              <Upload size={12} /> Load
            </button>
            <button onClick={() => setShowImport(!showImport)} className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-gray-400 hover:text-cyan-400 hover:bg-gray-800" title="Import from collection">
              <Plus size={12} /> Import
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-gray-800">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Dropdowns */}
        {showSaved && savedFlows.length > 0 && (
          <div className="px-5 py-2 border-b border-gray-800 bg-gray-800/30 space-y-1">
            <p className="text-[10px] text-gray-500 uppercase font-semibold">Saved Flows</p>
            {savedFlows.map(f => (
              <button key={f.name} onClick={() => loadFlow(f)}
                className="block w-full text-left px-3 py-1.5 rounded text-xs text-gray-300 hover:bg-gray-700/50">
                {f.name} ({f.nodes.length} steps)
              </button>
            ))}
          </div>
        )}

        {showImport && (
          <div className="px-5 py-2 border-b border-gray-800 bg-gray-800/30 space-y-1">
            <p className="text-[10px] text-gray-500 uppercase font-semibold">Import from Collection</p>
            {collections.map(c => (
              <button key={c.id} onClick={() => importFromCollection(c)}
                className="block w-full text-left px-3 py-1.5 rounded text-xs text-gray-300 hover:bg-gray-700/50">
                {c.name} ({c.requests.length} requests)
              </button>
            ))}
          </div>
        )}

        {/* Controls */}
        <div className="flex items-center gap-3 px-5 py-2 border-b border-gray-800 bg-gray-900/50">
          {!running ? (
            <button onClick={runFlow} disabled={nodes.length === 0 || !nodes.some(n => n.url)}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-cyan-600 text-white text-xs font-semibold hover:bg-cyan-500 disabled:opacity-50 transition-colors">
              <Play size={12} /> Run Flow
            </button>
          ) : (
            <button onClick={stopFlow}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-500 transition-colors">
              <Square size={12} /> Stop
            </button>
          )}
          <label className="flex items-center gap-1.5 text-xs text-gray-500">
            <input type="checkbox" checked={stopOnError} onChange={e => setStopOnError(e.target.checked)}
              className="w-3.5 h-3.5 rounded bg-gray-800 border-gray-700 text-cyan-500" />
            Stop on error
          </label>
          {totalTime !== null && (
            <div className="flex items-center gap-1 text-xs text-gray-500 ml-auto">
              <Clock size={12} />
              Total: {(totalTime / 1000).toFixed(2)}s
              <span className="mx-1 text-gray-700">|</span>
              {nodes.filter(n => n.status === 'success').length}/{nodes.length} passed
            </div>
          )}
        </div>

        {/* Nodes */}
        <div className="flex-1 overflow-y-auto p-5 space-y-0" style={{ maxHeight: 'calc(90vh - 200px)' }}>
          {nodes.map((node, i) => (
            <div key={node.id}>
              {/* Node */}
              <div className={`border rounded-xl transition-colors ${
                node.status === 'running' ? 'border-cyan-500/50 bg-cyan-500/5' :
                node.status === 'success' ? 'border-green-500/30 bg-green-500/5' :
                node.status === 'error' ? 'border-red-500/30 bg-red-500/5' :
                node.status === 'skipped' ? 'border-gray-700 bg-gray-800/20 opacity-50' :
                'border-gray-800 bg-gray-800/20'
              }`}>
                {/* Node header */}
                <div className="flex items-center gap-2 px-3 py-2 cursor-pointer" onClick={() => setExpandedNode(expandedNode === node.id ? null : node.id)}>
                  <span className="text-[10px] text-gray-600 font-mono w-5">#{i + 1}</span>
                  <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                    {node.status === 'running' && <Loader2 size={14} className="text-cyan-400 animate-spin" />}
                    {node.status === 'success' && <CheckCircle size={14} className="text-green-400" />}
                    {node.status === 'error' && <XCircle size={14} className="text-red-400" />}
                    {node.status === 'pending' && <div className="w-2.5 h-2.5 rounded-full border border-gray-600" />}
                    {node.status === 'skipped' && <div className="w-2.5 h-2.5 rounded-full bg-gray-700" />}
                  </div>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold font-mono ${METHOD_COLORS[node.method] || 'text-gray-400 bg-gray-800'}`}>
                    {node.method}
                  </span>
                  <span className="text-xs text-gray-300 font-mono truncate flex-1">
                    {node.url || <span className="text-gray-600 italic">No URL</span>}
                  </span>
                  {node.name && <span className="text-[10px] text-gray-500 truncate max-w-32">{node.name}</span>}
                  {node.response && (
                    <span className={`text-[10px] font-mono ${node.response.status < 300 ? 'text-green-400' : node.response.status < 400 ? 'text-blue-400' : 'text-red-400'}`}>
                      {node.response.status} ({Math.round(node.response.time)}ms)
                    </span>
                  )}
                  {expandedNode === node.id ? <ChevronDown size={12} className="text-gray-500" /> : <ChevronRight size={12} className="text-gray-500" />}
                  <button onClick={e => { e.stopPropagation(); removeNode(node.id); }}
                    className="p-1 rounded opacity-0 group-hover:opacity-100 hover:opacity-100 text-gray-600 hover:text-red-400 transition-all">
                    <Trash2 size={12} />
                  </button>
                </div>

                {/* Expanded config */}
                {expandedNode === node.id && (
                  <div className="px-3 pb-3 space-y-2 border-t border-gray-800/50 pt-2">
                    <div className="flex gap-2">
                      <input value={node.name} onChange={e => updateNode(node.id, { name: e.target.value })}
                        placeholder="Step name..." className="flex-1 bg-gray-800/30 border border-gray-800 rounded px-2 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-gray-700" />
                      <select value={node.method} onChange={e => updateNode(node.id, { method: e.target.value as HttpMethod })}
                        className="bg-gray-800 border border-gray-800 rounded px-2 py-1.5 text-xs text-gray-300 font-mono">
                        {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map(m => <option key={m}>{m}</option>)}
                      </select>
                    </div>
                    <input value={node.url} onChange={e => updateNode(node.id, { url: e.target.value })}
                      placeholder="URL — use {{step1.field}} for chaining" className="w-full bg-gray-800/30 border border-gray-800 rounded px-2 py-1.5 text-xs text-gray-200 font-mono focus:outline-none focus:border-gray-700" />

                    {node.method !== 'GET' && (
                      <textarea value={node.body} onChange={e => updateNode(node.id, { body: e.target.value })}
                        placeholder='{"key": "{{step1.id}}"}'
                        className="w-full bg-gray-800/30 border border-gray-800 rounded px-2 py-1.5 text-xs text-gray-200 font-mono resize-none focus:outline-none focus:border-gray-700 h-16" />
                    )}

                    {/* Headers */}
                    <div>
                      <p className="text-[10px] text-gray-500 uppercase font-semibold mb-1">Headers</p>
                      {node.headers.map((h, hi) => (
                        <div key={hi} className="flex gap-1 mb-1">
                          <input value={h.key} onChange={e => updateNode(node.id, { headers: node.headers.map((x, j) => j === hi ? { ...x, key: e.target.value } : x) })}
                            placeholder="Key" className="flex-1 bg-gray-800/30 border border-gray-800 rounded px-1.5 py-1 text-[10px] font-mono text-gray-300 focus:outline-none" />
                          <input value={h.value} onChange={e => updateNode(node.id, { headers: node.headers.map((x, j) => j === hi ? { ...x, value: e.target.value } : x) })}
                            placeholder="Value" className="flex-1 bg-gray-800/30 border border-gray-800 rounded px-1.5 py-1 text-[10px] font-mono text-gray-300 focus:outline-none" />
                          <button onClick={() => updateNode(node.id, { headers: node.headers.filter((_, j) => j !== hi) })} className="text-gray-600 hover:text-red-400"><X size={10} /></button>
                        </div>
                      ))}
                      <button onClick={() => updateNode(node.id, { headers: [...node.headers, { key: '', value: '' }] })} className="text-[10px] text-gray-500 hover:text-cyan-400">+ header</button>
                    </div>

                    {/* Extractions */}
                    <div>
                      <p className="text-[10px] text-gray-500 uppercase font-semibold mb-1">Extract Variables</p>
                      {node.extractions.map((ext, ei) => (
                        <div key={ei} className="flex gap-1 mb-1">
                          <input value={ext.variableName} onChange={e => updateNode(node.id, { extractions: node.extractions.map((x, j) => j === ei ? { ...x, variableName: e.target.value } : x) })}
                            placeholder="varName" className="flex-1 bg-gray-800/30 border border-gray-800 rounded px-1.5 py-1 text-[10px] font-mono text-gray-300 focus:outline-none" />
                          <input value={ext.jsonPath} onChange={e => updateNode(node.id, { extractions: node.extractions.map((x, j) => j === ei ? { ...x, jsonPath: e.target.value } : x) })}
                            placeholder="data.id" className="flex-1 bg-gray-800/30 border border-gray-800 rounded px-1.5 py-1 text-[10px] font-mono text-gray-300 focus:outline-none" />
                          <button onClick={() => updateNode(node.id, { extractions: node.extractions.filter((_, j) => j !== ei) })} className="text-gray-600 hover:text-red-400"><X size={10} /></button>
                        </div>
                      ))}
                      <button onClick={() => updateNode(node.id, { extractions: [...node.extractions, { variableName: '', jsonPath: '' }] })} className="text-[10px] text-gray-500 hover:text-cyan-400">+ extraction</button>
                    </div>

                    {/* Condition & Delay */}
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <p className="text-[10px] text-gray-500 uppercase font-semibold mb-1">Continue if</p>
                        <input value={node.condition} onChange={e => updateNode(node.id, { condition: e.target.value })}
                          placeholder="status === 200" className="w-full bg-gray-800/30 border border-gray-800 rounded px-2 py-1 text-[10px] font-mono text-gray-300 focus:outline-none" />
                      </div>
                      <div className="w-24">
                        <p className="text-[10px] text-gray-500 uppercase font-semibold mb-1">Delay (ms)</p>
                        <input type="number" value={node.delayMs} onChange={e => updateNode(node.id, { delayMs: parseInt(e.target.value) || 0 })}
                          className="w-full bg-gray-800/30 border border-gray-800 rounded px-2 py-1 text-[10px] font-mono text-gray-300 focus:outline-none" />
                      </div>
                    </div>

                    {/* Response preview */}
                    {node.response && (
                      <div>
                        <p className="text-[10px] text-gray-500 uppercase font-semibold mb-1">Response</p>
                        <pre className="p-2 rounded bg-gray-800/50 border border-gray-800 text-[10px] font-mono text-gray-400 max-h-32 overflow-auto whitespace-pre-wrap">
                          {(() => { try { return JSON.stringify(JSON.parse(node.response!.body), null, 2); } catch { return node.response!.body; } })()}
                        </pre>
                      </div>
                    )}
                    {node.error && (
                      <div className="p-2 rounded bg-red-500/10 border border-red-500/20 text-[10px] text-red-400">{node.error}</div>
                    )}
                  </div>
                )}
              </div>

              {/* Connector + Add button */}
              <div className="flex flex-col items-center py-1">
                <div className="w-px h-3 bg-gray-700" />
                <button onClick={() => addNodeAfter(i)}
                  className="p-0.5 rounded-full border border-gray-700 text-gray-600 hover:text-cyan-400 hover:border-cyan-500/50 transition-colors">
                  <Plus size={10} />
                </button>
                {i < nodes.length - 1 && <div className="w-px h-3 bg-gray-700" />}
              </div>
            </div>
          ))}

          {nodes.length === 0 && (
            <div className="flex flex-col items-center py-16 text-gray-600">
              <GripVertical size={32} className="mb-3 opacity-50" />
              <p className="text-sm">Add steps to build your API flow</p>
              <button onClick={() => addNodeAfter(-1)}
                className="mt-3 flex items-center gap-1 px-3 py-1.5 rounded-lg bg-cyan-600 text-white text-xs font-semibold hover:bg-cyan-500">
                <Plus size={12} /> Add First Step
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function evaluateCondition(condition: string, status: number): boolean {
  try {
    const cleaned = condition.trim();
    if (cleaned.includes('status')) {
      const expr = cleaned.replace(/status/g, String(status));
      if (/^[\d\s=!<>&|]+$/.test(expr)) {
        return new Function(`return ${expr}`)() as boolean;
      }
    }
    return true;
  } catch {
    return true;
  }
}
