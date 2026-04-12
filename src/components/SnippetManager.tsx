import { useState } from 'react';
import { useApp } from '../store/AppContext';
import type { RequestSnippet, KeyValue } from '../types';
import { generateId } from '../utils/helpers';
import { Plus, Trash2, Puzzle, ChevronDown, ChevronRight, X, Zap } from 'lucide-react';

const CATEGORIES = ['headers', 'params', 'body', 'auth', 'full'] as const;
const CATEGORY_COLORS: Record<string, string> = {
  headers: 'bg-blue-500/20 text-blue-400',
  params: 'bg-amber-500/20 text-amber-400',
  body: 'bg-green-500/20 text-green-400',
  auth: 'bg-red-500/20 text-red-400',
  full: 'bg-purple-500/20 text-purple-400',
};

export default function SnippetManager() {
  const { state, dispatch } = useApp();
  const { snippets } = state;
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState<RequestSnippet['category']>('headers');

  const createSnippet = () => {
    if (!newName.trim()) return;
    const snippet: RequestSnippet = {
      id: generateId(),
      name: newName,
      category: newCategory,
      headers: newCategory === 'headers' || newCategory === 'full' ? [{ id: generateId(), key: '', value: '', enabled: true }] : undefined,
      params: newCategory === 'params' ? [{ id: generateId(), key: '', value: '', enabled: true }] : undefined,
    };
    dispatch({ type: 'ADD_SNIPPET', snippet });
    setNewName('');
    setShowCreate(false);
    setExpandedId(snippet.id);
  };

  return (
    <div className="p-2">
      <div className="flex items-center justify-between px-2 py-1.5 mb-1">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Snippets</span>
        <button onClick={() => setShowCreate(true)} className="p-1 rounded-md hover:bg-gray-700 text-gray-400 hover:text-gray-200 transition-colors">
          <Plus size={14} />
        </button>
      </div>

      {showCreate && (
        <div className="px-2 mb-3 space-y-2 animate-slide-in">
          <input
            autoFocus value={newName} onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && createSnippet()}
            placeholder="Snippet name..."
            className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-brand-500"
          />
          <div className="flex flex-wrap gap-1">
            {CATEGORIES.map(cat => (
              <button key={cat} onClick={() => setNewCategory(cat)}
                className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${newCategory === cat ? CATEGORY_COLORS[cat] : 'bg-gray-800/50 text-gray-500'}`}
              >{cat}</button>
            ))}
          </div>
          <div className="flex gap-1">
            <button onClick={createSnippet} className="flex-1 py-1 rounded bg-brand-600 text-white text-xs font-medium">Create</button>
            <button onClick={() => setShowCreate(false)} className="px-2 py-1 rounded bg-gray-800 text-gray-400 text-xs"><X size={12} /></button>
          </div>
        </div>
      )}

      {snippets.length === 0 && !showCreate && (
        <div className="text-center py-6 px-3">
          <Puzzle size={24} className="mx-auto text-gray-700 mb-2" />
          <p className="text-xs text-gray-500 mb-1">No snippets yet</p>
          <p className="text-[10px] text-gray-600 mb-3">Save reusable headers, params, or auth configs</p>
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 mx-auto px-3 py-1.5 rounded-lg bg-accent-500/20 text-accent-400 text-xs font-medium hover:bg-accent-500/30 transition-colors"
          ><Plus size={12} />Create Snippet</button>
        </div>
      )}

      {snippets.map(snippet => (
        <div key={snippet.id} className="mb-1.5 rounded-lg border border-gray-800 overflow-hidden">
          <button
            onClick={() => setExpandedId(expandedId === snippet.id ? null : snippet.id)}
            className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-gray-800/50 transition-colors group"
          >
            {expandedId === snippet.id ? <ChevronDown size={12} className="text-gray-600" /> : <ChevronRight size={12} className="text-gray-600" />}
            <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${CATEGORY_COLORS[snippet.category]}`}>{snippet.category}</span>
            <span className="flex-1 text-sm text-gray-300 truncate">{snippet.name}</span>
            {snippet.builtIn && <span className="text-[8px] text-gray-600">built-in</span>}
            <button onClick={e => { e.stopPropagation(); dispatch({ type: 'DELETE_SNIPPET', id: snippet.id }); }}
              className="p-0.5 opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition-all">
              <Trash2 size={11} />
            </button>
          </button>

          {expandedId === snippet.id && (
            <SnippetEditor snippet={snippet} />
          )}
        </div>
      ))}
    </div>
  );
}

function SnippetEditor({ snippet }: { snippet: RequestSnippet }) {
  const { dispatch } = useApp();
  const update = (updates: Partial<RequestSnippet>) => dispatch({ type: 'UPDATE_SNIPPET', id: snippet.id, updates });

  const updateHeader = (idx: number, field: keyof KeyValue, value: string) => {
    const headers = [...(snippet.headers || [])];
    headers[idx] = { ...headers[idx], [field]: value };
    update({ headers });
  };

  const addHeader = () => update({ headers: [...(snippet.headers || []), { id: generateId(), key: '', value: '', enabled: true }] });
  const removeHeader = (idx: number) => update({ headers: (snippet.headers || []).filter((_, i) => i !== idx) });

  const updateParam = (idx: number, field: keyof KeyValue, value: string) => {
    const params = [...(snippet.params || [])];
    params[idx] = { ...params[idx], [field]: value };
    update({ params });
  };

  const addParam = () => update({ params: [...(snippet.params || []), { id: generateId(), key: '', value: '', enabled: true }] });
  const removeParam = (idx: number) => update({ params: (snippet.params || []).filter((_, i) => i !== idx) });

  return (
    <div className="px-3 pb-3 border-t border-gray-800 animate-slide-in bg-gray-900/30 space-y-2">
      {(snippet.category === 'headers' || snippet.category === 'full') && (
        <div className="mt-2">
          <span className="text-[10px] text-gray-600 uppercase tracking-wider font-semibold">Headers</span>
          {(snippet.headers || []).map((h, idx) => (
            <div key={h.id} className="flex items-center gap-1 mt-1">
              <input value={h.key} onChange={e => updateHeader(idx, 'key', e.target.value)} placeholder="Key"
                className="flex-1 bg-gray-800/50 border border-gray-800 rounded px-1.5 py-1 text-[11px] text-gray-300 font-mono focus:outline-none focus:border-gray-700" />
              <input value={h.value} onChange={e => updateHeader(idx, 'value', e.target.value)} placeholder="Value"
                className="flex-1 bg-gray-800/50 border border-gray-800 rounded px-1.5 py-1 text-[11px] text-gray-300 font-mono focus:outline-none focus:border-gray-700" />
              <button onClick={() => removeHeader(idx)} className="p-0.5 text-gray-600 hover:text-red-400"><X size={10} /></button>
            </div>
          ))}
          <button onClick={addHeader} className="text-[10px] text-brand-400 hover:text-brand-300 mt-1">+ Add header</button>
        </div>
      )}

      {(snippet.category === 'params') && (
        <div className="mt-2">
          <span className="text-[10px] text-gray-600 uppercase tracking-wider font-semibold">Params</span>
          {(snippet.params || []).map((p, idx) => (
            <div key={p.id} className="flex items-center gap-1 mt-1">
              <input value={p.key} onChange={e => updateParam(idx, 'key', e.target.value)} placeholder="Key"
                className="flex-1 bg-gray-800/50 border border-gray-800 rounded px-1.5 py-1 text-[11px] text-gray-300 font-mono focus:outline-none focus:border-gray-700" />
              <input value={p.value} onChange={e => updateParam(idx, 'value', e.target.value)} placeholder="Value"
                className="flex-1 bg-gray-800/50 border border-gray-800 rounded px-1.5 py-1 text-[11px] text-gray-300 font-mono focus:outline-none focus:border-gray-700" />
              <button onClick={() => removeParam(idx)} className="p-0.5 text-gray-600 hover:text-red-400"><X size={10} /></button>
            </div>
          ))}
          <button onClick={addParam} className="text-[10px] text-brand-400 hover:text-brand-300 mt-1">+ Add param</button>
        </div>
      )}

      <p className="text-[9px] text-gray-600 mt-2">
        <Zap size={8} className="inline" /> Use in Auth tab → select this snippet, or apply from the Snippets dropdown in the request bar
      </p>
    </div>
  );
}
