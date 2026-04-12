import { useState } from 'react';
import { useApp } from '../store/AppContext';
import type { AuthConfig, RequestConfig } from '../types';
import {
  Shield, RefreshCw, Zap, Key, Lock, Globe, Link2,
  ChevronDown, AlertCircle, Clock, Loader2
} from 'lucide-react';

interface Props {
  request: RequestConfig;
}

export default function AuthEditor({ request }: Props) {
  const { state, dispatch, fetchOAuth2Token, fetchTokenProfile } = useApp();
  const { auth } = request;
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);

  const updateAuth = (updates: Partial<AuthConfig>) => {
    dispatch({
      type: 'UPDATE_REQUEST',
      requestId: request.id,
      updates: { auth: { ...auth, ...updates } },
    });
  };

  const updateOAuth2 = (updates: Partial<NonNullable<AuthConfig['oauth2']>>) => {
    dispatch({
      type: 'UPDATE_REQUEST',
      requestId: request.id,
      updates: {
        auth: {
          ...auth,
          oauth2: { ...auth.oauth2!, ...updates },
        },
      },
    });
  };

  const selectedProfile = auth.tokenProfileId
    ? state.tokenProfiles.find(p => p.id === auth.tokenProfileId)
    : null;

  return (
    <div className="space-y-4">
      {/* Auth type selector */}
      <div className="flex flex-wrap gap-2">
        {[
          { type: 'none' as const, label: 'No Auth', icon: Shield },
          { type: 'token-profile' as const, label: 'Token Profile', icon: Link2 },
          { type: 'bearer' as const, label: 'Bearer Token', icon: Key },
          { type: 'basic' as const, label: 'Basic Auth', icon: Lock },
          { type: 'api-key' as const, label: 'API Key', icon: Key },
          { type: 'oauth2' as const, label: 'OAuth 2.0', icon: Globe },
        ].map(opt => (
          <button
            key={opt.type}
            onClick={() => {
              const base: AuthConfig = { type: opt.type };
              if (opt.type === 'oauth2') {
                base.oauth2 = {
                  grantType: 'client_credentials',
                  tokenUrl: '',
                  clientId: '',
                  clientSecret: '',
                  autoRefresh: true,
                };
              }
              updateAuth(base);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              auth.type === opt.type
                ? opt.type === 'token-profile'
                  ? 'bg-accent-500/20 text-accent-400 ring-1 ring-accent-500/30'
                  : 'bg-brand-500/20 text-brand-400 ring-1 ring-brand-500/30'
                : 'bg-gray-800/50 text-gray-500 hover:text-gray-300 hover:bg-gray-800'
            }`}
          >
            <opt.icon size={12} />
            {opt.label}
          </button>
        ))}
      </div>

      {/* TOKEN PROFILE SELECTOR */}
      {auth.type === 'token-profile' && (
        <div className="space-y-4">
          {/* Dropdown to pick a token profile */}
          <div>
            <label className="text-xs text-gray-500 font-medium">Select Token Profile</label>
            <div className="relative mt-1.5">
              <button
                onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg bg-gray-800/50 border border-gray-700 text-sm hover:border-gray-600 transition-colors"
              >
                {selectedProfile ? (
                  <div className="flex items-center gap-2 min-w-0">
                    <ProfileStatusDot status={selectedProfile.status} />
                    <span className="text-gray-200 truncate">{selectedProfile.name}</span>
                    {selectedProfile.status === 'active' && (
                      <span className="text-[9px] font-mono text-green-500/70 flex-shrink-0">
                        ...{selectedProfile.currentToken?.slice(-8)}
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-gray-500">Choose a token profile...</span>
                )}
                <ChevronDown size={14} className="text-gray-500 flex-shrink-0" />
              </button>

              {showProfileDropdown && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowProfileDropdown(false)} />
                  <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-20 py-1 max-h-60 overflow-y-auto animate-slide-in">
                    {state.tokenProfiles.length === 0 ? (
                      <div className="px-3 py-4 text-center">
                        <Key size={18} className="mx-auto text-gray-600 mb-1.5" />
                        <p className="text-xs text-gray-500">No token profiles yet</p>
                        <button
                          onClick={() => {
                            setShowProfileDropdown(false);
                            dispatch({ type: 'SET_SIDEBAR_TAB', tab: 'tokens' });
                          }}
                          className="mt-2 text-[10px] text-accent-400 hover:text-accent-300"
                        >
                          Create one in Tokens tab →
                        </button>
                      </div>
                    ) : (
                      <>
                        {state.tokenProfiles.map(p => (
                          <button
                            key={p.id}
                            onClick={() => {
                              updateAuth({ tokenProfileId: p.id });
                              setShowProfileDropdown(false);
                            }}
                            className={`w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-gray-700/50 transition-colors ${
                              auth.tokenProfileId === p.id ? 'bg-gray-700/30' : ''
                            }`}
                          >
                            <ProfileStatusDot status={p.status} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-gray-200 truncate">{p.name}</p>
                              <p className="text-[10px] text-gray-500 font-mono truncate">{p.tokenEndpoint || 'No endpoint set'}</p>
                            </div>
                            {p.status === 'active' && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-green-500/10 text-green-400 flex-shrink-0">Active</span>
                            )}
                            {p.status === 'error' && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 flex-shrink-0">Error</span>
                            )}
                            {auth.tokenProfileId === p.id && (
                              <span className="text-brand-400 flex-shrink-0">✓</span>
                            )}
                          </button>
                        ))}
                        <div className="border-t border-gray-700 mt-1 pt-1">
                          <button
                            onClick={() => {
                              setShowProfileDropdown(false);
                              dispatch({ type: 'SET_SIDEBAR_TAB', tab: 'tokens' });
                            }}
                            className="w-full px-3 py-1.5 text-left text-[11px] text-gray-500 hover:text-accent-400 transition-colors"
                          >
                            + Manage token profiles...
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Selected profile status */}
          {selectedProfile && (
            <div className="space-y-3">
              {/* Active token banner */}
              {selectedProfile.status === 'active' && selectedProfile.currentToken && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                  <Zap size={16} className="text-green-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-green-400 font-medium">Token Active — Auto-injected</p>
                    <p className="text-[10px] text-green-500/60 font-mono truncate mt-0.5">
                      {selectedProfile.tokenPrefix && `${selectedProfile.tokenPrefix} `}{selectedProfile.currentToken.substring(0, 40)}...
                    </p>
                    <div className="flex items-center gap-3 mt-1 text-[10px] text-green-500/50">
                      <span>→ {selectedProfile.injectAs === 'header' ? `Header: ${selectedProfile.injectKey}` : `Query: ${selectedProfile.injectKey}`}</span>
                      {selectedProfile.tokenExpiry && (
                        <span className="flex items-center gap-0.5">
                          <Clock size={8} />
                          Expires: {new Date(selectedProfile.tokenExpiry).toLocaleTimeString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => fetchTokenProfile(selectedProfile.id)}
                    className="p-1.5 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors flex-shrink-0"
                    title="Refresh token now"
                  >
                    <RefreshCw size={14} />
                  </button>
                </div>
              )}

              {/* Fetching */}
              {selectedProfile.status === 'fetching' && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <Loader2 size={16} className="text-amber-400 animate-spin flex-shrink-0" />
                  <p className="text-xs text-amber-400">Fetching token from {selectedProfile.tokenEndpoint}...</p>
                </div>
              )}

              {/* Error */}
              {selectedProfile.status === 'error' && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                  <AlertCircle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-red-400 font-medium">Token fetch failed</p>
                    <p className="text-[10px] text-red-400/70 mt-0.5 break-all">{selectedProfile.error}</p>
                  </div>
                  <button
                    onClick={() => fetchTokenProfile(selectedProfile.id)}
                    className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors flex-shrink-0"
                  >
                    <RefreshCw size={14} />
                  </button>
                </div>
              )}

              {/* Idle — no token yet */}
              {selectedProfile.status === 'idle' && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-800/30 border border-gray-800">
                  <Key size={16} className="text-gray-600 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs text-gray-400">No token fetched yet</p>
                    <p className="text-[10px] text-gray-600 mt-0.5">
                      {selectedProfile.autoRefresh
                        ? 'Token will be auto-fetched when you send the request'
                        : 'Click the button to fetch a token'}
                    </p>
                  </div>
                  <button
                    onClick={() => fetchTokenProfile(selectedProfile.id)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-accent-500/20 text-accent-400 text-xs font-medium hover:bg-accent-500/30 transition-colors flex-shrink-0"
                  >
                    <Zap size={12} />
                    Fetch
                  </button>
                </div>
              )}

              {/* Info box */}
              <div className="p-2.5 rounded-lg bg-brand-500/5 border border-brand-500/10">
                <p className="text-[10px] text-brand-400/70 leading-relaxed">
                  When you hit Send, FetchLab will automatically call your token endpoint,
                  extract the token, and inject it into this request. No copy-pasting needed.
                  {selectedProfile.autoRefresh && ' Tokens are refreshed automatically before they expire.'}
                </p>
              </div>
            </div>
          )}

          {!selectedProfile && state.tokenProfiles.length > 0 && (
            <div className="flex items-center gap-3 p-4 rounded-lg bg-gray-800/30 border border-gray-800">
              <Link2 size={20} className="text-gray-600" />
              <div>
                <p className="text-sm text-gray-400">Select a token profile above</p>
                <p className="text-xs text-gray-600 mt-0.5">The token will be auto-fetched and injected when you send</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Auth config forms */}
      {auth.type === 'none' && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-gray-800/30 border border-gray-800">
          <Shield size={20} className="text-gray-600" />
          <div>
            <p className="text-sm text-gray-400">No authentication</p>
            <p className="text-xs text-gray-600 mt-0.5">This request will not include any auth credentials</p>
          </div>
        </div>
      )}

      {auth.type === 'bearer' && (
        <div className="space-y-3">
          <label className="block">
            <span className="text-xs text-gray-500 font-medium">Token</span>
            <input
              value={auth.bearer?.token || ''}
              onChange={e => updateAuth({ bearer: { token: e.target.value } })}
              placeholder="Enter bearer token or {{variable}}"
              className="mt-1 w-full bg-gray-800/50 border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-200 font-mono focus:outline-none focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/20"
            />
          </label>
          <p className="text-[11px] text-gray-600">
            The token will be sent as: <code className="text-gray-400">Authorization: Bearer {'<token>'}</code>
          </p>
        </div>
      )}

      {auth.type === 'basic' && (
        <div className="space-y-3">
          <label className="block">
            <span className="text-xs text-gray-500 font-medium">Username</span>
            <input
              value={auth.basic?.username || ''}
              onChange={e => updateAuth({ basic: { ...auth.basic!, username: e.target.value } })}
              placeholder="Username"
              className="mt-1 w-full bg-gray-800/50 border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/20"
            />
          </label>
          <label className="block">
            <span className="text-xs text-gray-500 font-medium">Password</span>
            <input
              type="password"
              value={auth.basic?.password || ''}
              onChange={e => updateAuth({ basic: { ...auth.basic!, password: e.target.value } })}
              placeholder="Password"
              className="mt-1 w-full bg-gray-800/50 border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/20"
            />
          </label>
        </div>
      )}

      {auth.type === 'api-key' && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs text-gray-500 font-medium">Key</span>
              <input
                value={auth.apiKey?.key || ''}
                onChange={e => updateAuth({ apiKey: { ...auth.apiKey!, key: e.target.value } })}
                placeholder="e.g. X-API-Key"
                className="mt-1 w-full bg-gray-800/50 border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/20"
              />
            </label>
            <label className="block">
              <span className="text-xs text-gray-500 font-medium">Value</span>
              <input
                value={auth.apiKey?.value || ''}
                onChange={e => updateAuth({ apiKey: { ...auth.apiKey!, value: e.target.value } })}
                placeholder="API key value"
                className="mt-1 w-full bg-gray-800/50 border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-200 font-mono focus:outline-none focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/20"
              />
            </label>
          </div>
          <div className="flex gap-2">
            <label className="text-xs text-gray-500 font-medium mr-2 self-center">Add to:</label>
            {(['header', 'query'] as const).map(opt => (
              <button
                key={opt}
                onClick={() => updateAuth({ apiKey: { ...auth.apiKey!, addTo: opt } })}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                  auth.apiKey?.addTo === opt
                    ? 'bg-brand-500/20 text-brand-400'
                    : 'bg-gray-800/50 text-gray-500 hover:text-gray-300'
                }`}
              >
                {opt === 'header' ? 'Header' : 'Query Param'}
              </button>
            ))}
          </div>
        </div>
      )}

      {auth.type === 'oauth2' && auth.oauth2 && (
        <div className="space-y-4">
          {auth.oauth2.accessToken && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
              <Zap size={16} className="text-green-400" />
              <div className="flex-1">
                <p className="text-xs text-green-400 font-medium">Token Active</p>
                <p className="text-[10px] text-green-500/60 font-mono truncate mt-0.5">
                  {auth.oauth2.accessToken.substring(0, 40)}...
                </p>
                {auth.oauth2.tokenExpiry && (
                  <p className="text-[10px] text-green-500/60 mt-0.5">
                    Expires: {new Date(auth.oauth2.tokenExpiry).toLocaleString()}
                  </p>
                )}
              </div>
              <button
                onClick={() => fetchOAuth2Token(request.id)}
                className="p-1.5 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors"
                title="Refresh token"
              >
                <RefreshCw size={14} />
              </button>
            </div>
          )}

          <div>
            <span className="text-xs text-gray-500 font-medium">Grant Type</span>
            <div className="flex gap-2 mt-1.5">
              {[
                { value: 'client_credentials' as const, label: 'Client Credentials' },
                { value: 'password' as const, label: 'Password' },
                { value: 'authorization_code' as const, label: 'Auth Code' },
              ].map(gt => (
                <button
                  key={gt.value}
                  onClick={() => updateOAuth2({ grantType: gt.value })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    auth.oauth2!.grantType === gt.value
                      ? 'bg-accent-500/20 text-accent-400 ring-1 ring-accent-500/30'
                      : 'bg-gray-800/50 text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {gt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs text-gray-500 font-medium">Token URL</span>
              <input
                value={auth.oauth2.tokenUrl}
                onChange={e => updateOAuth2({ tokenUrl: e.target.value })}
                placeholder="https://auth.example.com/token"
                className="mt-1 w-full bg-gray-800/50 border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-200 font-mono focus:outline-none focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/20"
              />
            </label>
            {auth.oauth2.grantType === 'authorization_code' && (
              <label className="block">
                <span className="text-xs text-gray-500 font-medium">Auth URL</span>
                <input
                  value={auth.oauth2.authUrl || ''}
                  onChange={e => updateOAuth2({ authUrl: e.target.value })}
                  placeholder="https://auth.example.com/authorize"
                  className="mt-1 w-full bg-gray-800/50 border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-200 font-mono focus:outline-none focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/20"
                />
              </label>
            )}
            <label className="block">
              <span className="text-xs text-gray-500 font-medium">Client ID</span>
              <input
                value={auth.oauth2.clientId}
                onChange={e => updateOAuth2({ clientId: e.target.value })}
                placeholder="Client ID"
                className="mt-1 w-full bg-gray-800/50 border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-200 font-mono focus:outline-none focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/20"
              />
            </label>
            <label className="block">
              <span className="text-xs text-gray-500 font-medium">Client Secret</span>
              <input
                type="password"
                value={auth.oauth2.clientSecret}
                onChange={e => updateOAuth2({ clientSecret: e.target.value })}
                placeholder="Client Secret"
                className="mt-1 w-full bg-gray-800/50 border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-200 font-mono focus:outline-none focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/20"
              />
            </label>
            <label className="block">
              <span className="text-xs text-gray-500 font-medium">Scope (optional)</span>
              <input
                value={auth.oauth2.scope || ''}
                onChange={e => updateOAuth2({ scope: e.target.value })}
                placeholder="read write"
                className="mt-1 w-full bg-gray-800/50 border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/20"
              />
            </label>
          </div>

          {auth.oauth2.grantType === 'password' && (
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs text-gray-500 font-medium">Username</span>
                <input
                  value={auth.oauth2.username || ''}
                  onChange={e => updateOAuth2({ username: e.target.value })}
                  className="mt-1 w-full bg-gray-800/50 border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/20"
                />
              </label>
              <label className="block">
                <span className="text-xs text-gray-500 font-medium">Password</span>
                <input
                  type="password"
                  value={auth.oauth2.password || ''}
                  onChange={e => updateOAuth2({ password: e.target.value })}
                  className="mt-1 w-full bg-gray-800/50 border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/20"
                />
              </label>
            </div>
          )}

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={auth.oauth2.autoRefresh}
                onChange={e => updateOAuth2({ autoRefresh: e.target.checked })}
                className="w-4 h-4 rounded bg-gray-800 border-gray-700 text-brand-500 focus:ring-brand-500/30"
              />
              <span className="text-xs text-gray-400">Auto-refresh token before expiry</span>
            </label>

            <button
              onClick={() => fetchOAuth2Token(request.id)}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-accent-500/20 text-accent-400 text-xs font-medium hover:bg-accent-500/30 transition-colors"
            >
              <Zap size={12} />
              Get Token
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ProfileStatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    idle: 'bg-gray-600',
    fetching: 'bg-amber-400 animate-pulse',
    active: 'bg-green-400',
    expired: 'bg-amber-500',
    error: 'bg-red-400',
  };
  return <div className={`w-2 h-2 rounded-full flex-shrink-0 ${colors[status] || 'bg-gray-600'}`} />;
}
