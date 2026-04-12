import { useState, useCallback } from 'react';
import { useApp } from '../store/AppContext';
import AuthEditor from './AuthEditor';
import ResizeHandle from './ResizeHandle';
import ExportDialog from './ExportDialog';
import ScriptEditor from './ScriptEditor';
import type { HttpMethod, KeyValue, ResponseExtraction } from '../types';
import { generateId } from '../utils/helpers';
import { parseCurl } from '../utils/curlParser';
import {
  Send, Loader2, Plus, Trash2, Save, ChevronDown,
  FileJson, AlignLeft, FormInput, Code, Share2, X
} from 'lucide-react';

export default function RequestBuilder() {
  const { state, dispatch, sendRequest } = useApp();
  const activeTab = state.tabs.find(t => t.id === state.activeTabId);
  const request = activeTab ? state.requests[activeTab.requestId] : null;
  const isLoading = activeTab ? state.loading[activeTab.requestId] : false;
  const [activeSection, setActiveSection] = useState<'params' | 'headers' | 'body' | 'auth' | 'scripts' | 'extractions'>('params');
  const [showMethodDropdown, setShowMethodDropdown] = useState(false);
  const [showSaveDropdown, setShowSaveDropdown] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);

  if (!request || !activeTab) {
    return (
      <div className="flex items-center justify-center h-full text-gray-600">
        <p>Open or create a request to get started</p>
      </div>
    );
  }

  const methods: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

  const updateRequest = (updates: Partial<typeof request>) => {
    dispatch({ type: 'UPDATE_REQUEST', requestId: request.id, updates });
  };

  const updateKeyValues = (field: 'params' | 'headers', values: KeyValue[]) => {
    updateRequest({ [field]: values });
  };

  const addKeyValue = (field: 'params' | 'headers') => {
    const current = request[field];
    updateKeyValues(field, [...current, { id: generateId(), key: '', value: '', enabled: true }]);
  };

  const handleSend = () => {
    sendRequest(request.id);
  };

  const saveToCollection = (collectionId: string) => {
    dispatch({ type: 'SAVE_TO_COLLECTION', collectionId, request });
    setShowSaveDropdown(false);
  };

  const paramCount = request.params.filter(p => p.enabled && p.key).length;
  const headerCount = request.headers.filter(h => h.enabled && h.key).length;

  return (
    <div className="flex flex-col h-full">
      {/* URL Bar */}
      <div className="flex items-center gap-2 p-3 bg-gray-900/30">
        {/* Method selector */}
        <div className="relative">
          <button
            onClick={() => setShowMethodDropdown(!showMethodDropdown)}
            className={`flex items-center gap-1 px-3 py-2.5 rounded-lg bg-gray-800 border border-gray-700 font-mono font-bold text-sm min-w-[100px] justify-between hover:border-gray-600 transition-colors method-${request.method.toLowerCase()}`}
          >
            {request.method}
            <ChevronDown size={14} className="text-gray-500" />
          </button>
          {showMethodDropdown && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowMethodDropdown(false)} />
              <div className="absolute top-full left-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-20 py-1 min-w-[120px] animate-slide-in">
                {methods.map(m => (
                  <button
                    key={m}
                    onClick={() => { updateRequest({ method: m }); setShowMethodDropdown(false); }}
                    className={`w-full px-3 py-1.5 text-left text-sm font-mono font-semibold hover:bg-gray-700/50 transition-colors method-${m.toLowerCase()}`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* URL input */}
        <div className="flex-1 relative">
          <input
            value={request.url}
            onChange={e => {
              const val = e.target.value;
              // Auto-detect pasted cURL
              if (val.trimStart().toLowerCase().startsWith('curl ')) {
                const parsed = parseCurl(val);
                if (parsed) {
                  updateRequest(parsed);
                  return;
                }
              }
              updateRequest({ url: val });
            }}
            onPaste={e => {
              const text = e.clipboardData.getData('text');
              if (text.trimStart().toLowerCase().startsWith('curl ')) {
                e.preventDefault();
                const parsed = parseCurl(text);
                if (parsed) {
                  updateRequest(parsed);
                }
              }
            }}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder="Enter URL or paste cURL command..."
            className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-gray-100 font-mono placeholder-gray-600 focus:outline-none focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/20 transition-all"
          />
          {request.url.includes('{{') && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-400 font-mono">ENV</span>
            </div>
          )}
        </div>

        {/* Send button */}
        <button
          onClick={handleSend}
          disabled={isLoading || !request.url}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-brand-600 text-white text-sm font-semibold hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-brand-600/20"
        >
          {isLoading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Send size={16} />
          )}
          Send
        </button>

        {/* Save dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowSaveDropdown(!showSaveDropdown)}
            className="p-2.5 rounded-lg bg-gray-800 border border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-600 transition-colors"
            title="Save to collection"
          >
            <Save size={16} />
          </button>
          {showSaveDropdown && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowSaveDropdown(false)} />
              <div className="absolute top-full right-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-20 py-1 min-w-[200px] animate-slide-in">
                <div className="px-3 py-1.5 text-[10px] text-gray-600 uppercase tracking-wider font-semibold">
                  Save to collection
                </div>
                {state.collections.map(col => (
                  <button
                    key={col.id}
                    onClick={() => saveToCollection(col.id)}
                    className="w-full px-3 py-1.5 text-left text-sm text-gray-300 hover:bg-gray-700/50 transition-colors"
                  >
                    {col.name}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Export / Share button */}
        <button
          onClick={() => setShowExportDialog(true)}
          className="p-2.5 rounded-lg bg-gray-800 border border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-600 transition-colors"
          title="Export / Share request"
        >
          <Share2 size={16} />
        </button>
      </div>

      {/* Export dialog */}
      {showExportDialog && (
        <ExportDialog
          target={{ type: 'request', request }}
          onClose={() => setShowExportDialog(false)}
        />
      )}

      {/* Section tabs */}
      <div className="flex items-center gap-1 px-3 border-b border-gray-800 overflow-x-auto scrollbar-hide">
        {[
          { id: 'params' as const, label: 'Params', count: paramCount },
          { id: 'headers' as const, label: 'Headers', count: headerCount },
          { id: 'body' as const, label: 'Body' },
          { id: 'auth' as const, label: 'Auth' },
          { id: 'scripts' as const, label: 'Scripts' },
          { id: 'extractions' as const, label: 'Extract' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSection(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
              activeSection === tab.id
                ? 'border-brand-400 text-brand-400'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-brand-500/20 text-brand-400 text-[10px] font-semibold">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Section content */}
      <div className="flex-1 overflow-y-auto p-3">
        {activeSection === 'params' && (
          <KeyValueEditor
            items={request.params}
            onChange={values => updateKeyValues('params', values)}
            onAdd={() => addKeyValue('params')}
            keyPlaceholder="Parameter name"
            valuePlaceholder="Value"
          />
        )}

        {activeSection === 'headers' && (
          <KeyValueEditor
            items={request.headers}
            onChange={values => updateKeyValues('headers', values)}
            onAdd={() => addKeyValue('headers')}
            keyPlaceholder="Header name"
            valuePlaceholder="Value"
          />
        )}

        {activeSection === 'body' && (
          <BodyEditor request={request} onChange={updateRequest} />
        )}

        {activeSection === 'auth' && (
          <AuthEditor request={request} />
        )}

        {activeSection === 'scripts' && (
          <div className="space-y-6">
            <ScriptEditor
              type="pre-request"
              value={request.preRequestScript || ''}
              onChange={v => updateRequest({ preRequestScript: v })}
            />
            <ScriptEditor
              type="test"
              value={request.testScript || ''}
              onChange={v => updateRequest({ testScript: v })}
            />
          </div>
        )}

        {activeSection === 'extractions' && (
          <ExtractionsEditor
            extractions={request.responseExtractions || []}
            onChange={exts => updateRequest({ responseExtractions: exts })}
          />
        )}
      </div>
    </div>
  );
}

function KeyValueEditor({
  items,
  onChange,
  onAdd,
  keyPlaceholder,
  valuePlaceholder,
}: {
  items: KeyValue[];
  onChange: (items: KeyValue[]) => void;
  onAdd: () => void;
  keyPlaceholder: string;
  valuePlaceholder: string;
}) {
  const update = (id: string, field: keyof KeyValue, value: string | boolean) => {
    onChange(items.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const remove = (id: string) => {
    onChange(items.filter(item => item.id !== id));
  };

  return (
    <div className="space-y-1.5">
      {/* Header row */}
      <div className="flex items-center gap-2 px-1 text-[10px] text-gray-600 uppercase tracking-wider font-semibold">
        <div className="w-5" />
        <div className="flex-1">Key</div>
        <div className="flex-1">Value</div>
        <div className="w-7" />
      </div>

      {items.map(item => (
        <div key={item.id} className="flex items-center gap-2 group">
          <input
            type="checkbox"
            checked={item.enabled}
            onChange={e => update(item.id, 'enabled', e.target.checked)}
            className="w-4 h-4 rounded bg-gray-800 border-gray-700 text-brand-500 focus:ring-brand-500/30"
          />
          <input
            value={item.key}
            onChange={e => update(item.id, 'key', e.target.value)}
            placeholder={keyPlaceholder}
            className={`flex-1 bg-gray-800/30 border border-gray-800 rounded px-2.5 py-1.5 text-xs font-mono focus:outline-none focus:border-gray-700 transition-colors ${
              item.enabled ? 'text-gray-200' : 'text-gray-600'
            }`}
          />
          <input
            value={item.value}
            onChange={e => update(item.id, 'value', e.target.value)}
            placeholder={valuePlaceholder}
            className={`flex-1 bg-gray-800/30 border border-gray-800 rounded px-2.5 py-1.5 text-xs font-mono focus:outline-none focus:border-gray-700 transition-colors ${
              item.enabled ? 'text-gray-200' : 'text-gray-600'
            }`}
          />
          <button
            onClick={() => remove(item.id)}
            className="p-1 rounded opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition-all"
          >
            <Trash2 size={12} />
          </button>
        </div>
      ))}

      <button
        onClick={onAdd}
        className="flex items-center gap-1.5 px-2 py-1.5 rounded text-xs text-gray-500 hover:text-brand-400 hover:bg-gray-800/50 transition-colors"
      >
        <Plus size={12} />
        Add parameter
      </button>
    </div>
  );
}

function BodyEditor({
  request,
  onChange,
}: {
  request: import('../types').RequestConfig;
  onChange: (updates: Partial<import('../types').RequestConfig>) => void;
}) {
  const { body } = request;
  const [bodyHeight, setBodyHeight] = useState(() => {
    try {
      const saved = localStorage.getItem('fetchlab_body_height');
      if (saved) return parseFloat(saved);
    } catch { /* ignore */ }
    return 192;
  });

  const handleBodyResize = useCallback((delta: number) => {
    setBodyHeight(prev => {
      const next = Math.min(500, Math.max(80, prev + delta));
      try { localStorage.setItem('fetchlab_body_height', String(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const updateBody = (updates: Partial<typeof body>) => {
    onChange({ body: { ...body, ...updates } });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {[
          { type: 'none' as const, label: 'None', icon: AlignLeft },
          { type: 'json' as const, label: 'JSON', icon: FileJson },
          { type: 'form-data' as const, label: 'Form Data', icon: FormInput },
          { type: 'x-www-form-urlencoded' as const, label: 'URL Encoded', icon: FormInput },
          { type: 'raw' as const, label: 'Raw', icon: Code },
        ].map(opt => (
          <button
            key={opt.type}
            onClick={() => updateBody({ type: opt.type })}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              body.type === opt.type
                ? 'bg-brand-500/20 text-brand-400 ring-1 ring-brand-500/30'
                : 'bg-gray-800/50 text-gray-500 hover:text-gray-300 hover:bg-gray-800'
            }`}
          >
            <opt.icon size={12} />
            {opt.label}
          </button>
        ))}
      </div>

      {body.type === 'none' && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-gray-800/30 border border-gray-800">
          <AlignLeft size={20} className="text-gray-600" />
          <p className="text-sm text-gray-500">This request does not have a body</p>
        </div>
      )}

      {(body.type === 'json' || body.type === 'raw') && (
        <div>
          <div className="relative">
            <textarea
              value={body.content}
              onChange={e => updateBody({ content: e.target.value })}
              placeholder={body.type === 'json' ? '{\n  "key": "value"\n}' : 'Enter raw body content...'}
              className="w-full bg-gray-800/30 border border-gray-800 rounded-lg px-4 py-3 text-sm text-gray-200 font-mono resize-none focus:outline-none focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/20 leading-relaxed"
              style={{ height: bodyHeight }}
              spellCheck={false}
            />
            {body.type === 'json' && body.content && (
              <div className="absolute top-2 right-2 flex gap-1">
                <button
                  onClick={() => {
                    try {
                      const formatted = JSON.stringify(JSON.parse(body.content), null, 2);
                      updateBody({ content: formatted });
                    } catch { /* invalid JSON */ }
                  }}
                  className="px-2 py-0.5 rounded text-[10px] bg-gray-700/50 text-gray-400 hover:text-gray-200 transition-colors"
                >
                  Format
                </button>
              </div>
            )}
          </div>
          <ResizeHandle direction="vertical" onResize={handleBodyResize} />
        </div>
      )}

      {(body.type === 'form-data' || body.type === 'x-www-form-urlencoded') && (
        <KeyValueFormEditor
          items={body.formData || []}
          onChange={formData => updateBody({ formData })}
        />
      )}
    </div>
  );
}

function KeyValueFormEditor({
  items,
  onChange,
}: {
  items: KeyValue[];
  onChange: (items: KeyValue[]) => void;
}) {
  const update = (id: string, field: keyof KeyValue, value: string | boolean) => {
    onChange(items.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  return (
    <div className="space-y-1.5">
      {items.map(item => (
        <div key={item.id} className="flex items-center gap-2 group">
          <input
            type="checkbox"
            checked={item.enabled}
            onChange={e => update(item.id, 'enabled', e.target.checked)}
            className="w-4 h-4 rounded bg-gray-800 border-gray-700 text-brand-500 focus:ring-brand-500/30"
          />
          <input
            value={item.key}
            onChange={e => update(item.id, 'key', e.target.value)}
            placeholder="Key"
            className="flex-1 bg-gray-800/30 border border-gray-800 rounded px-2.5 py-1.5 text-xs font-mono text-gray-200 focus:outline-none focus:border-gray-700"
          />
          <input
            value={item.value}
            onChange={e => update(item.id, 'value', e.target.value)}
            placeholder="Value"
            className="flex-1 bg-gray-800/30 border border-gray-800 rounded px-2.5 py-1.5 text-xs font-mono text-gray-200 focus:outline-none focus:border-gray-700"
          />
          <button
            onClick={() => onChange(items.filter(i => i.id !== item.id))}
            className="p-1 rounded opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition-all"
          >
            <Trash2 size={12} />
          </button>
        </div>
      ))}
      <button
        onClick={() => onChange([...items, { id: generateId(), key: '', value: '', enabled: true }])}
        className="flex items-center gap-1.5 px-2 py-1.5 rounded text-xs text-gray-500 hover:text-brand-400 hover:bg-gray-800/50 transition-colors"
      >
        <Plus size={12} />
        Add field
      </button>
    </div>
  );
}

function ExtractionsEditor({
  extractions,
  onChange,
}: {
  extractions: ResponseExtraction[];
  onChange: (exts: ResponseExtraction[]) => void;
}) {
  const addExtraction = () => {
    onChange([...extractions, { id: generateId(), variableName: '', jsonPath: '', source: 'body', enabled: true }]);
  };

  const update = (id: string, field: keyof ResponseExtraction, value: string | boolean) => {
    onChange(extractions.map(e => e.id === id ? { ...e, [field]: value } : e));
  };

  const remove = (id: string) => {
    onChange(extractions.filter(e => e.id !== id));
  };

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs text-gray-400 mb-1">Extract values from the response and save as variables</p>
        <p className="text-[10px] text-gray-600">Use <code className="text-gray-500">{'{{variableName}}'}</code> in other requests to reference extracted values</p>
      </div>

      <div className="space-y-2">
        {extractions.map(ext => (
          <div key={ext.id} className="flex items-center gap-2 group">
            <input
              type="checkbox"
              checked={ext.enabled}
              onChange={e => update(ext.id, 'enabled', e.target.checked)}
              className="w-3.5 h-3.5 rounded bg-gray-800 border-gray-700 text-brand-500"
            />
            <input
              value={ext.variableName}
              onChange={e => update(ext.id, 'variableName', e.target.value)}
              placeholder="Variable name"
              className="flex-1 bg-gray-800/30 border border-gray-800 rounded px-2 py-1.5 text-xs font-mono text-gray-200 focus:outline-none focus:border-gray-700"
            />
            <input
              value={ext.jsonPath}
              onChange={e => update(ext.id, 'jsonPath', e.target.value)}
              placeholder="e.g. data.token"
              className="flex-1 bg-gray-800/30 border border-gray-800 rounded px-2 py-1.5 text-xs font-mono text-gray-200 focus:outline-none focus:border-gray-700"
            />
            <select
              value={ext.source}
              onChange={e => update(ext.id, 'source', e.target.value)}
              className="bg-gray-800 border border-gray-800 rounded px-1.5 py-1.5 text-xs text-gray-400 focus:outline-none"
            >
              <option value="body">Body</option>
              <option value="headers">Headers</option>
            </select>
            <button onClick={() => remove(ext.id)} className="p-1 rounded opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition-all">
              <X size={12} />
            </button>
          </div>
        ))}
      </div>

      <button onClick={addExtraction} className="flex items-center gap-1.5 px-2 py-1.5 rounded text-xs text-gray-500 hover:text-brand-400 hover:bg-gray-800/50 transition-colors">
        <Plus size={12} />
        Add extraction
      </button>
    </div>
  );
}
