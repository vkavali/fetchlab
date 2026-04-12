import { useState } from 'react';
import { useApp } from '../store/AppContext';
import type { TokenProfile, KeyValue } from '../types';
import { generateId } from '../utils/helpers';
import {
  Plus, Trash2, ChevronDown, ChevronRight, Zap, RefreshCw,
  AlertCircle, X, Key, Loader2, Clock
} from 'lucide-react';

export default function TokenManager() {
  const { state, dispatch, fetchTokenProfile } = useApp();
  const { tokenProfiles } = state;
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);

  const addProfile = () => {
    const profile: TokenProfile = {
      id: generateId(),
      name: 'New Token',
      tokenEndpoint: '',
      method: 'POST',
      authType: 'body',
      headers: [],
      bodyType: 'json',
      bodyContent: '',
      bodyFormData: [],
      tokenPath: 'access_token',
      expiresInPath: 'expires_in',
      tokenPrefix: 'Bearer',
      injectAs: 'header',
      injectKey: 'Authorization',
      status: 'idle',
      autoRefresh: true,
      refreshBeforeExpirySec: 30,
    };
    dispatch({ type: 'ADD_TOKEN_PROFILE', profile });
    setExpandedId(profile.id);
    setShowNew(false);
  };

  return (
    <div className="p-2">
      <div className="flex items-center justify-between px-2 py-1 mb-2">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Token Profiles</span>
        <button
          onClick={addProfile}
          className="p-1 rounded hover:bg-gray-700 text-gray-500 hover:text-gray-300 transition-colors"
          title="Add token profile"
        >
          <Plus size={14} />
        </button>
      </div>

      {/* Hint when empty */}
      {tokenProfiles.length === 0 && !showNew && (
        <div className="text-center py-6 px-3">
          <Key size={24} className="mx-auto text-gray-700 mb-2" />
          <p className="text-xs text-gray-500 mb-1">No token profiles yet</p>
          <p className="text-[10px] text-gray-600 mb-3">
            Set up a token endpoint once, then attach it to any request. No more copy-pasting tokens!
          </p>
          <button
            onClick={addProfile}
            className="flex items-center gap-1.5 mx-auto px-3 py-1.5 rounded-lg bg-accent-500/20 text-accent-400 text-xs font-medium hover:bg-accent-500/30 transition-colors"
          >
            <Plus size={12} />
            Create Token Profile
          </button>
        </div>
      )}

      {/* Profile list */}
      {tokenProfiles.map(profile => (
        <div key={profile.id} className="mb-2 rounded-lg border border-gray-800 overflow-hidden">
          {/* Profile header */}
          <button
            onClick={() => setExpandedId(expandedId === profile.id ? null : profile.id)}
            className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-gray-800/50 transition-colors group"
          >
            {expandedId === profile.id
              ? <ChevronDown size={12} className="text-gray-600 flex-shrink-0" />
              : <ChevronRight size={12} className="text-gray-600 flex-shrink-0" />
            }
            <StatusDot status={profile.status} />
            <span className="flex-1 text-sm text-gray-300 truncate">{profile.name}</span>

            {profile.status === 'active' && profile.currentToken && (
              <span className="text-[9px] font-mono text-green-500/70 truncate max-w-[60px]">
                ...{profile.currentToken.slice(-8)}
              </span>
            )}

            <button
              onClick={e => {
                e.stopPropagation();
                fetchTokenProfile(profile.id);
              }}
              className="p-1 rounded opacity-0 group-hover:opacity-100 text-gray-500 hover:text-accent-400 transition-all"
              title="Fetch token now"
            >
              {profile.status === 'fetching'
                ? <Loader2 size={12} className="animate-spin" />
                : <RefreshCw size={12} />
              }
            </button>
            <button
              onClick={e => {
                e.stopPropagation();
                dispatch({ type: 'DELETE_TOKEN_PROFILE', id: profile.id });
              }}
              className="p-1 rounded opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition-all"
            >
              <Trash2 size={12} />
            </button>
          </button>

          {/* Expanded editor */}
          {expandedId === profile.id && (
            <TokenProfileEditor profile={profile} />
          )}
        </div>
      ))}
    </div>
  );
}

function StatusDot({ status }: { status: TokenProfile['status'] }) {
  const colors: Record<string, string> = {
    idle: 'bg-gray-600',
    fetching: 'bg-amber-400 animate-pulse',
    active: 'bg-green-400',
    expired: 'bg-amber-500',
    error: 'bg-red-400',
  };
  return <div className={`w-2 h-2 rounded-full flex-shrink-0 ${colors[status]}`} />;
}

function TokenProfileEditor({ profile }: { profile: TokenProfile }) {
  const { dispatch, fetchTokenProfile } = useApp();

  const update = (updates: Partial<TokenProfile>) => {
    dispatch({ type: 'UPDATE_TOKEN_PROFILE', id: profile.id, updates });
  };

  const addHeader = () => {
    update({ headers: [...profile.headers, { id: generateId(), key: '', value: '', enabled: true }] });
  };

  const updateHeader = (hId: string, field: keyof KeyValue, value: string | boolean) => {
    update({ headers: profile.headers.map(h => h.id === hId ? { ...h, [field]: value } : h) });
  };

  const removeHeader = (hId: string) => {
    update({ headers: profile.headers.filter(h => h.id !== hId) });
  };

  const addFormField = () => {
    update({ bodyFormData: [...profile.bodyFormData, { id: generateId(), key: '', value: '', enabled: true }] });
  };

  const updateFormField = (fId: string, field: keyof KeyValue, value: string | boolean) => {
    update({ bodyFormData: profile.bodyFormData.map(f => f.id === fId ? { ...f, [field]: value } : f) });
  };

  const removeFormField = (fId: string) => {
    update({ bodyFormData: profile.bodyFormData.filter(f => f.id !== fId) });
  };

  return (
    <div className="px-3 pb-3 space-y-3 border-t border-gray-800 animate-slide-in bg-gray-900/30">
      {/* Token status banner */}
      {profile.status === 'active' && profile.currentToken && (
        <div className="mt-3 flex items-center gap-2 p-2 rounded-lg bg-green-500/10 border border-green-500/20">
          <Zap size={14} className="text-green-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-green-400 font-medium">Token Active</p>
            <p className="text-[9px] text-green-500/60 font-mono truncate">{profile.currentToken}</p>
            {profile.tokenExpiry && (
              <p className="text-[9px] text-green-500/50 flex items-center gap-1 mt-0.5">
                <Clock size={8} />
                Expires: {new Date(profile.tokenExpiry).toLocaleTimeString()}
              </p>
            )}
          </div>
        </div>
      )}
      {profile.status === 'error' && profile.error && (
        <div className="mt-3 flex items-start gap-2 p-2 rounded-lg bg-red-500/10 border border-red-500/20">
          <AlertCircle size={14} className="text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-[10px] text-red-400 break-all">{profile.error}</p>
        </div>
      )}

      {/* Name */}
      <div className="mt-3">
        <label className="text-[10px] text-gray-600 uppercase tracking-wider font-semibold">Profile Name</label>
        <input
          value={profile.name}
          onChange={e => update({ name: e.target.value })}
          placeholder="e.g. Auth Service Token"
          className="mt-1 w-full bg-gray-800/50 border border-gray-800 rounded px-2 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-brand-500/50"
        />
      </div>

      {/* Token Endpoint */}
      <div>
        <label className="text-[10px] text-gray-600 uppercase tracking-wider font-semibold">Token Endpoint</label>
        <div className="flex gap-1 mt-1">
          <select
            value={profile.method}
            onChange={e => update({ method: e.target.value as 'GET' | 'POST' })}
            className="bg-gray-800 border border-gray-800 rounded px-2 py-1.5 text-xs text-gray-300 focus:outline-none"
          >
            <option value="POST">POST</option>
            <option value="GET">GET</option>
          </select>
          <input
            value={profile.tokenEndpoint}
            onChange={e => update({ tokenEndpoint: e.target.value })}
            placeholder="https://auth.example.com/oauth/token"
            className="flex-1 bg-gray-800/50 border border-gray-800 rounded px-2 py-1.5 text-xs text-gray-200 font-mono focus:outline-none focus:border-brand-500/50"
          />
        </div>
      </div>

      {/* Request Headers */}
      <div>
        <div className="flex items-center justify-between">
          <label className="text-[10px] text-gray-600 uppercase tracking-wider font-semibold">Headers</label>
          <button onClick={addHeader} className="text-[10px] text-brand-400 hover:text-brand-300">+ Add</button>
        </div>
        {profile.headers.map(h => (
          <div key={h.id} className="flex items-center gap-1 mt-1">
            <input
              value={h.key}
              onChange={e => updateHeader(h.id, 'key', e.target.value)}
              placeholder="Key"
              className="flex-1 bg-gray-800/50 border border-gray-800 rounded px-1.5 py-1 text-[11px] text-gray-300 font-mono focus:outline-none focus:border-gray-700"
            />
            <input
              value={h.value}
              onChange={e => updateHeader(h.id, 'value', e.target.value)}
              placeholder="Value"
              className="flex-1 bg-gray-800/50 border border-gray-800 rounded px-1.5 py-1 text-[11px] text-gray-300 font-mono focus:outline-none focus:border-gray-700"
            />
            <button onClick={() => removeHeader(h.id)} className="p-0.5 text-gray-600 hover:text-red-400"><X size={10} /></button>
          </div>
        ))}
      </div>

      {/* Request Body (for POST) */}
      {profile.method === 'POST' && (
        <div>
          <label className="text-[10px] text-gray-600 uppercase tracking-wider font-semibold">Body Type</label>
          <div className="flex gap-1 mt-1">
            {(['json', 'x-www-form-urlencoded', 'none'] as const).map(t => (
              <button
                key={t}
                onClick={() => update({ bodyType: t })}
                className={`px-2 py-1 rounded text-[10px] font-medium transition-colors ${
                  profile.bodyType === t
                    ? 'bg-brand-500/20 text-brand-400'
                    : 'bg-gray-800/50 text-gray-500 hover:text-gray-300'
                }`}
              >
                {t === 'json' ? 'JSON' : t === 'x-www-form-urlencoded' ? 'Form' : 'None'}
              </button>
            ))}
          </div>

          {profile.bodyType === 'json' && (
            <textarea
              value={profile.bodyContent}
              onChange={e => update({ bodyContent: e.target.value })}
              placeholder={'{\n  "client_id": "...",\n  "client_secret": "...",\n  "grant_type": "client_credentials"\n}'}
              className="mt-1.5 w-full h-24 bg-gray-800/50 border border-gray-800 rounded px-2 py-1.5 text-[11px] text-gray-200 font-mono resize-y focus:outline-none focus:border-brand-500/50 leading-relaxed"
              spellCheck={false}
            />
          )}

          {profile.bodyType === 'x-www-form-urlencoded' && (
            <div className="mt-1.5 space-y-1">
              {profile.bodyFormData.map(f => (
                <div key={f.id} className="flex items-center gap-1">
                  <input
                    value={f.key}
                    onChange={e => updateFormField(f.id, 'key', e.target.value)}
                    placeholder="Key"
                    className="flex-1 bg-gray-800/50 border border-gray-800 rounded px-1.5 py-1 text-[11px] text-gray-300 font-mono focus:outline-none focus:border-gray-700"
                  />
                  <input
                    value={f.value}
                    onChange={e => updateFormField(f.id, 'value', e.target.value)}
                    placeholder="Value"
                    className="flex-1 bg-gray-800/50 border border-gray-800 rounded px-1.5 py-1 text-[11px] text-gray-300 font-mono focus:outline-none focus:border-gray-700"
                  />
                  <button onClick={() => removeFormField(f.id)} className="p-0.5 text-gray-600 hover:text-red-400"><X size={10} /></button>
                </div>
              ))}
              <button onClick={addFormField} className="text-[10px] text-brand-400 hover:text-brand-300">+ Add field</button>
            </div>
          )}
        </div>
      )}

      {/* Response Extraction */}
      <div className="p-2 rounded-lg bg-gray-800/30 border border-gray-800 space-y-2">
        <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Response Token Extraction</p>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-gray-600">Token Path</label>
            <input
              value={profile.tokenPath}
              onChange={e => update({ tokenPath: e.target.value })}
              placeholder="access_token"
              className="mt-0.5 w-full bg-gray-800/50 border border-gray-800 rounded px-1.5 py-1 text-[11px] text-gray-200 font-mono focus:outline-none focus:border-gray-700"
            />
          </div>
          <div>
            <label className="text-[10px] text-gray-600">Expires In Path</label>
            <input
              value={profile.expiresInPath || ''}
              onChange={e => update({ expiresInPath: e.target.value })}
              placeholder="expires_in"
              className="mt-0.5 w-full bg-gray-800/50 border border-gray-800 rounded px-1.5 py-1 text-[11px] text-gray-200 font-mono focus:outline-none focus:border-gray-700"
            />
          </div>
        </div>
        <p className="text-[9px] text-gray-600">
          Use dot notation for nested fields: <code className="text-gray-500">data.token</code> or <code className="text-gray-500">result.access_token</code>
        </p>
      </div>

      {/* Injection Config */}
      <div className="p-2 rounded-lg bg-gray-800/30 border border-gray-800 space-y-2">
        <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Inject Into Request</p>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="text-[10px] text-gray-600">Prefix</label>
            <input
              value={profile.tokenPrefix}
              onChange={e => update({ tokenPrefix: e.target.value })}
              placeholder="Bearer"
              className="mt-0.5 w-full bg-gray-800/50 border border-gray-800 rounded px-1.5 py-1 text-[11px] text-gray-200 focus:outline-none focus:border-gray-700"
            />
          </div>
          <div>
            <label className="text-[10px] text-gray-600">Add To</label>
            <select
              value={profile.injectAs}
              onChange={e => update({ injectAs: e.target.value as 'header' | 'query' })}
              className="mt-0.5 w-full bg-gray-800 border border-gray-800 rounded px-1.5 py-1 text-[11px] text-gray-300 focus:outline-none"
            >
              <option value="header">Header</option>
              <option value="query">Query Param</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] text-gray-600">Key Name</label>
            <input
              value={profile.injectKey}
              onChange={e => update({ injectKey: e.target.value })}
              placeholder="Authorization"
              className="mt-0.5 w-full bg-gray-800/50 border border-gray-800 rounded px-1.5 py-1 text-[11px] text-gray-200 font-mono focus:outline-none focus:border-gray-700"
            />
          </div>
        </div>
      </div>

      {/* Auto-refresh toggle */}
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={profile.autoRefresh}
            onChange={e => update({ autoRefresh: e.target.checked })}
            className="w-3.5 h-3.5 rounded bg-gray-800 border-gray-700 text-brand-500 focus:ring-brand-500/30"
          />
          <span className="text-[11px] text-gray-400">Auto-refresh before expiry</span>
        </label>
        <input
          type="number"
          value={profile.refreshBeforeExpirySec}
          onChange={e => update({ refreshBeforeExpirySec: parseInt(e.target.value) || 30 })}
          className="w-14 bg-gray-800/50 border border-gray-800 rounded px-1.5 py-0.5 text-[10px] text-gray-400 text-center font-mono focus:outline-none"
          title="Seconds before expiry to refresh"
        />
        <span className="text-[9px] text-gray-600">sec</span>
      </div>

      {/* Fetch button */}
      <button
        onClick={() => fetchTokenProfile(profile.id)}
        disabled={profile.status === 'fetching' || !profile.tokenEndpoint}
        className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-accent-500/20 text-accent-400 text-xs font-medium hover:bg-accent-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {profile.status === 'fetching' ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          <Zap size={14} />
        )}
        {profile.status === 'fetching' ? 'Fetching...' : 'Fetch Token Now'}
      </button>
    </div>
  );
}
