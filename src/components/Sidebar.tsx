import { useState } from 'react';
import { useApp } from '../store/AppContext';
import {
  generateId, importFromJsonFile, copyToClipboard, generateCodeSnippet, requestToShareableJson
} from '../utils/helpers';
import type { Collection, Environment, KeyValue, RequestConfig } from '../types';
import {
  FolderOpen, History, Globe, Plus, Trash2, ChevronRight, ChevronDown,
  Clock, Search, Check, X, Key, Download, Upload, Terminal, Copy, Play
} from 'lucide-react';
import TokenManager from './TokenManager';
import ExportDialog from './ExportDialog';
import CollectionRunner from './CollectionRunner';

export default function Sidebar() {
  const { state, dispatch } = useApp();
  const { sidebarTab, collections, history, environments, activeEnvironmentId } = state;

  return (
    <div className="flex flex-col h-full bg-gray-900/50 border-r border-gray-800">
      {/* Sidebar tabs */}
      <div className="flex overflow-x-auto border-b border-gray-800 scrollbar-hide">
        {[
          { id: 'collections' as const, icon: FolderOpen, label: 'Collections' },
          { id: 'history' as const, icon: History, label: 'History' },
          { id: 'environments' as const, icon: Globe, label: 'Env' },
          { id: 'tokens' as const, icon: Key, label: 'Tokens' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => dispatch({ type: 'SET_SIDEBAR_TAB', tab: tab.id })}
            className={`flex-shrink-0 flex-1 flex items-center justify-center gap-1.5 py-2.5 px-2 text-xs font-medium transition-colors ${
              sidebarTab === tab.id
                ? 'text-brand-400 border-b-2 border-brand-400 bg-brand-400/5'
                : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/50'
            }`}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {sidebarTab === 'collections' && (
          <CollectionsPanel collections={collections} />
        )}
        {sidebarTab === 'history' && (
          <HistoryPanel history={history} />
        )}
        {sidebarTab === 'environments' && (
          <EnvironmentsPanel
            environments={environments}
            activeId={activeEnvironmentId}
          />
        )}
        {sidebarTab === 'tokens' && (
          <TokenManager />
        )}
      </div>
    </div>
  );
}

function CollectionsPanel({ collections }: { collections: Collection[] }) {
  const { dispatch } = useApp();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ [collections[0]?.id]: true });
  const [newName, setNewName] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [exportTarget, setExportTarget] = useState<
    { type: 'request'; request: RequestConfig } | { type: 'collection'; collection: Collection } | null
  >(null);
  const [runnerCollection, setRunnerCollection] = useState<Collection | null>(null);

  const toggleExpand = (id: string) => {
    setExpanded(p => ({ ...p, [id]: !p[id] }));
  };

  const addCollection = () => {
    if (!newName.trim()) return;
    dispatch({
      type: 'ADD_COLLECTION',
      collection: { id: generateId(), name: newName, requests: [] },
    });
    setNewName('');
    setShowNew(false);
  };

  const handleExportCollection = (e: React.MouseEvent, col: Collection) => {
    e.stopPropagation();
    setExportTarget({ type: 'collection', collection: col });
  };

  const handleImportCollection = async () => {
    try {
      const data = await importFromJsonFile() as { _fetchlab?: string; _type?: string; name?: string; requests?: RequestConfig[] };
      if (data._type === 'collection' && data.name && Array.isArray(data.requests)) {
        const col: Collection = {
          id: generateId(),
          name: data.name,
          requests: data.requests.map(r => ({ ...r, id: generateId() })),
        };
        dispatch({ type: 'ADD_COLLECTION', collection: col });
      } else if (data._type === 'request' && data.name) {
        // Single request — open it directly
        dispatch({ type: 'OPEN_REQUEST', request: data as unknown as RequestConfig });
      }
    } catch { /* user cancelled or invalid file */ }
  };

  const handleCopyCurl = (e: React.MouseEvent, req: RequestConfig) => {
    e.stopPropagation();
    const curl = generateCodeSnippet(req, 'curl');
    copyToClipboard(curl);
    setCopiedId(req.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopyRequestJson = (e: React.MouseEvent, req: RequestConfig) => {
    e.stopPropagation();
    const json = JSON.stringify(requestToShareableJson(req), null, 2);
    copyToClipboard(json);
    setCopiedId(req.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleExportRequest = (e: React.MouseEvent, req: RequestConfig) => {
    e.stopPropagation();
    setExportTarget({ type: 'request', request: req });
  };

  return (
    <div className="p-2">
      <div className="flex items-center justify-between px-2 py-1.5 mb-1">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Collections</span>
        <div className="flex items-center gap-1">
          <button
            onClick={handleImportCollection}
            className="flex items-center gap-1 px-2 py-1 rounded-md bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-gray-200 text-[10px] font-medium transition-colors border border-gray-700/50"
            title="Import collection from JSON"
          >
            <Upload size={12} />
            Import
          </button>
          <button
            onClick={() => setShowNew(true)}
            className="p-1 rounded-md hover:bg-gray-700 text-gray-400 hover:text-gray-200 transition-colors"
            title="New collection"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>

      {showNew && (
        <div className="flex items-center gap-1 px-2 mb-2 animate-slide-in">
          <input
            autoFocus
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addCollection()}
            placeholder="Collection name..."
            className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-brand-500"
          />
          <button onClick={addCollection} className="p-1 text-green-400 hover:bg-gray-700 rounded"><Check size={12} /></button>
          <button onClick={() => setShowNew(false)} className="p-1 text-gray-500 hover:bg-gray-700 rounded"><X size={12} /></button>
        </div>
      )}

      {collections.map(col => (
        <div key={col.id} className="mb-1">
          <button
            onClick={() => toggleExpand(col.id)}
            className="flex items-center gap-1.5 w-full px-2 py-1.5 rounded text-left text-sm text-gray-300 hover:bg-gray-800/70 transition-colors group"
          >
            {expanded[col.id] ? <ChevronDown size={14} className="text-gray-600" /> : <ChevronRight size={14} className="text-gray-600" />}
            <FolderOpen size={14} className="text-brand-400/70" />
            <span className="flex-1 truncate">{col.name}</span>
            <span className="text-xs text-gray-600">{col.requests.length}</span>
            <button
              onClick={e => { e.stopPropagation(); dispatch({ type: 'DELETE_COLLECTION', id: col.id }); }}
              className="p-1 rounded opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition-all"
            >
              <Trash2 size={12} />
            </button>
          </button>

          {expanded[col.id] && (
            <div className="ml-4 border-l border-gray-800 pl-2 animate-slide-in">
              {/* Collection actions */}
              <div className="flex items-center gap-1 mb-1 px-1">
                <button
                  onClick={() => setRunnerCollection(col)}
                  className="flex items-center gap-1.5 flex-1 px-2 py-1.5 rounded text-[10px] font-medium text-gray-500 hover:text-green-400 hover:bg-green-500/10 transition-colors"
                >
                  <Play size={11} />
                  Run All
                </button>
                <button
                  onClick={e => handleExportCollection(e, col)}
                  className="flex items-center gap-1.5 flex-1 px-2 py-1.5 rounded text-[10px] font-medium text-gray-500 hover:text-brand-400 hover:bg-gray-800/50 transition-colors"
                >
                  <Download size={11} />
                  Export
                </button>
              </div>

              {col.requests.map(req => (
                <div
                  key={req.id}
                  className="flex items-center gap-1 w-full px-2 py-1.5 rounded text-left text-xs hover:bg-gray-800/50 transition-colors group"
                >
                  <button
                    onClick={() => dispatch({ type: 'OPEN_REQUEST', request: req })}
                    className="flex items-center gap-2 flex-1 min-w-0"
                  >
                    <span className={`font-mono font-semibold text-[10px] w-10 flex-shrink-0 method-${req.method.toLowerCase()}`}>
                      {req.method}
                    </span>
                    <span className="flex-1 truncate text-gray-400 group-hover:text-gray-200">{req.name || req.url}</span>
                  </button>
                  {/* Share actions */}
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    {copiedId === req.id ? (
                      <span className="text-[9px] text-green-400 px-1 font-medium">Copied!</span>
                    ) : (
                      <>
                        <button
                          onClick={e => handleCopyCurl(e, req)}
                          className="p-1 rounded text-gray-500 hover:text-green-400 hover:bg-gray-700/50 transition-colors"
                          title="Copy as cURL"
                        >
                          <Terminal size={12} />
                        </button>
                        <button
                          onClick={e => handleCopyRequestJson(e, req)}
                          className="p-1 rounded text-gray-500 hover:text-brand-400 hover:bg-gray-700/50 transition-colors opacity-0 group-hover:opacity-100"
                          title="Copy as JSON"
                        >
                          <Copy size={12} />
                        </button>
                        <button
                          onClick={e => handleExportRequest(e, req)}
                          className="p-1 rounded text-gray-500 hover:text-amber-400 hover:bg-gray-700/50 transition-colors opacity-0 group-hover:opacity-100"
                          title="Export as file"
                        >
                          <Download size={12} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
              {col.requests.length === 0 && (
                <p className="text-xs text-gray-600 px-2 py-1 italic">No requests</p>
              )}
            </div>
          )}
        </div>
      ))}

      {/* Export dialog */}
      {exportTarget && (
        <ExportDialog target={exportTarget} onClose={() => setExportTarget(null)} />
      )}

      {/* Collection runner */}
      {runnerCollection && (
        <CollectionRunner collection={runnerCollection} onClose={() => setRunnerCollection(null)} />
      )}
    </div>
  );
}

function HistoryPanel({ history }: { history: import('../types').HistoryEntry[] }) {
  const { dispatch } = useApp();
  const [search, setSearch] = useState('');

  const filtered = history.filter(h =>
    h.request.url.toLowerCase().includes(search.toLowerCase()) ||
    h.request.method.toLowerCase().includes(search.toLowerCase())
  );

  const grouped = filtered.reduce<Record<string, typeof history>>((acc, entry) => {
    const date = new Date(entry.timestamp);
    const key = date.toLocaleDateString();
    (acc[key] = acc[key] || []).push(entry);
    return acc;
  }, {});

  return (
    <div className="p-2">
      <div className="flex items-center justify-between px-2 py-1 mb-2">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">History</span>
        {history.length > 0 && (
          <button
            onClick={() => dispatch({ type: 'CLEAR_HISTORY' })}
            className="text-xs text-gray-600 hover:text-red-400 transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      <div className="relative mb-2 px-1">
        <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search history..."
          className="w-full bg-gray-800/50 border border-gray-800 rounded pl-7 pr-2 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-gray-700"
        />
      </div>

      {Object.entries(grouped).map(([date, entries]) => (
        <div key={date} className="mb-3">
          <div className="flex items-center gap-2 px-2 py-1">
            <Clock size={10} className="text-gray-600" />
            <span className="text-[10px] text-gray-600 font-medium">{date}</span>
          </div>
          {entries.map(entry => (
            <button
              key={entry.id}
              onClick={() => dispatch({ type: 'OPEN_REQUEST', request: entry.request })}
              className="flex items-center gap-2 w-full px-2 py-1.5 rounded text-left text-xs hover:bg-gray-800/50 transition-colors"
            >
              <span className={`font-mono font-semibold text-[10px] w-10 method-${entry.request.method.toLowerCase()}`}>
                {entry.request.method}
              </span>
              <span className="flex-1 truncate text-gray-400">{entry.request.url}</span>
              {entry.response && (
                <span className={`text-[10px] font-mono ${entry.response.status < 400 ? 'text-green-500' : 'text-red-400'}`}>
                  {entry.response.status}
                </span>
              )}
            </button>
          ))}
        </div>
      ))}

      {history.length === 0 && (
        <div className="text-center py-8">
          <History size={24} className="mx-auto text-gray-700 mb-2" />
          <p className="text-xs text-gray-600">No history yet</p>
          <p className="text-[10px] text-gray-700 mt-1">Send a request to see it here</p>
        </div>
      )}
    </div>
  );
}

function EnvironmentsPanel({ environments, activeId }: { environments: Environment[]; activeId: string | null }) {
  const { dispatch } = useApp();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');

  const addEnv = () => {
    if (!newName.trim()) return;
    const env: Environment = {
      id: generateId(),
      name: newName,
      isActive: false,
      variables: [{ id: generateId(), key: '', value: '', enabled: true }],
    };
    dispatch({ type: 'ADD_ENVIRONMENT', environment: env });
    setNewName('');
    setShowNew(false);
  };

  const addVariable = (envId: string, env: Environment) => {
    dispatch({
      type: 'UPDATE_ENVIRONMENT',
      id: envId,
      updates: {
        variables: [...env.variables, { id: generateId(), key: '', value: '', enabled: true }],
      },
    });
  };

  const updateVariable = (envId: string, env: Environment, varId: string, updates: Partial<KeyValue>) => {
    dispatch({
      type: 'UPDATE_ENVIRONMENT',
      id: envId,
      updates: {
        variables: env.variables.map(v => v.id === varId ? { ...v, ...updates } : v),
      },
    });
  };

  const removeVariable = (envId: string, env: Environment, varId: string) => {
    dispatch({
      type: 'UPDATE_ENVIRONMENT',
      id: envId,
      updates: {
        variables: env.variables.filter(v => v.id !== varId),
      },
    });
  };

  return (
    <div className="p-2">
      <div className="flex items-center justify-between px-2 py-1 mb-1">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Environments</span>
        <button onClick={() => setShowNew(true)} className="p-1 rounded hover:bg-gray-700 text-gray-500 hover:text-gray-300 transition-colors">
          <Plus size={14} />
        </button>
      </div>

      {showNew && (
        <div className="flex items-center gap-1 px-2 mb-2 animate-slide-in">
          <input
            autoFocus
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addEnv()}
            placeholder="Environment name..."
            className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-brand-500"
          />
          <button onClick={addEnv} className="p-1 text-green-400 hover:bg-gray-700 rounded"><Check size={12} /></button>
          <button onClick={() => setShowNew(false)} className="p-1 text-gray-500 hover:bg-gray-700 rounded"><X size={12} /></button>
        </div>
      )}

      {environments.map(env => (
        <div key={env.id} className="mb-2">
          <div className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-800/50 group">
            <button
              onClick={() => dispatch({ type: 'SET_ACTIVE_ENVIRONMENT', id: activeId === env.id ? null : env.id })}
              className={`w-3 h-3 rounded-full border-2 transition-colors ${
                activeId === env.id ? 'border-green-400 bg-green-400' : 'border-gray-600 hover:border-gray-400'
              }`}
            />
            <button
              onClick={() => setEditingId(editingId === env.id ? null : env.id)}
              className="flex-1 text-left text-sm text-gray-300"
            >
              {env.name}
            </button>
            <button
              onClick={() => dispatch({ type: 'DELETE_ENVIRONMENT', id: env.id })}
              className="p-0.5 opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition-all"
            >
              <Trash2 size={12} />
            </button>
          </div>

          {editingId === env.id && (
            <div className="ml-5 mt-1 space-y-1 animate-slide-in">
              {env.variables.map(v => (
                <div key={v.id} className="flex items-center gap-1">
                  <input
                    value={v.key}
                    onChange={e => updateVariable(env.id, env, v.id, { key: e.target.value })}
                    placeholder="Key"
                    className="flex-1 bg-gray-800 border border-gray-800 rounded px-1.5 py-1 text-[11px] text-gray-300 font-mono focus:outline-none focus:border-gray-700"
                  />
                  <input
                    value={v.value}
                    onChange={e => updateVariable(env.id, env, v.id, { value: e.target.value })}
                    placeholder="Value"
                    className="flex-1 bg-gray-800 border border-gray-800 rounded px-1.5 py-1 text-[11px] text-gray-300 font-mono focus:outline-none focus:border-gray-700"
                  />
                  <button onClick={() => removeVariable(env.id, env, v.id)} className="p-0.5 text-gray-600 hover:text-red-400"><X size={10} /></button>
                </div>
              ))}
              <button
                onClick={() => addVariable(env.id, env)}
                className="text-[10px] text-brand-400 hover:text-brand-300 px-1"
              >
                + Add variable
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
