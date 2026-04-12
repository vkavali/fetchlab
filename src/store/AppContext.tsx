import { createContext, useContext, useReducer, useCallback, useEffect, type ReactNode } from 'react';
import type { RequestConfig, ResponseData, HistoryEntry, Collection, Environment, Tab, TokenProfile, RequestSnippet, TestResult, ScriptConsoleEntry, ResponseSnapshot } from '../types';
import { runPreRequestScript, runTestScript } from '../utils/scriptRunner';
import { generateId, createDefaultRequest } from '../utils/helpers';

const STORAGE_KEY = 'fetchlab_state';

interface PersistedState {
  history: HistoryEntry[];
  collections: Collection[];
  environments: Environment[];
  activeEnvironmentId: string | null;
  tokenProfiles: TokenProfile[];
  tabs: Tab[];
  requests: Record<string, RequestConfig>;
  snippets: RequestSnippet[];
  snapshots: ResponseSnapshot[];
}

function saveToStorage(state: AppState) {
  try {
    const persisted: PersistedState = {
      history: state.history,
      collections: state.collections,
      environments: state.environments,
      activeEnvironmentId: state.activeEnvironmentId,
      tokenProfiles: state.tokenProfiles.map(p => ({
        ...p,
        status: p.status === 'fetching' ? 'idle' : p.status,
      })),
      tabs: state.tabs,
      requests: state.requests,
      snippets: state.snippets,
      snapshots: state.snapshots,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
  } catch {
    // localStorage full or unavailable — silently ignore
  }
}

function loadFromStorage(): Partial<AppState> | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Partial<PersistedState>;
    // Basic validation — if any core array is missing, treat as corrupt
    if (!Array.isArray(data.history) || !Array.isArray(data.collections)) return null;
    return data;
  } catch {
    return null;
  }
}

// Helper: extract a value from a JSON object using a dot-path like "data.access_token"
function extractByPath(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((cur, key) => {
    if (cur && typeof cur === 'object' && key in (cur as Record<string, unknown>)) {
      return (cur as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

type SidebarTab = 'collections' | 'history' | 'environments' | 'tokens' | 'snippets';

interface AppState {
  tabs: Tab[];
  activeTabId: string | null;
  requests: Record<string, RequestConfig>;
  responses: Record<string, ResponseData | null>;
  loading: Record<string, boolean>;
  history: HistoryEntry[];
  collections: Collection[];
  environments: Environment[];
  activeEnvironmentId: string | null;
  sidebarOpen: boolean;
  sidebarTab: SidebarTab;
  tokenProfiles: TokenProfile[];
  snippets: RequestSnippet[];
  testResults: Record<string, TestResult[]>;
  scriptConsole: Record<string, ScriptConsoleEntry[]>;
  snapshots: ResponseSnapshot[];
  chainVariables: Record<string, string>;
}

type Action =
  | { type: 'NEW_TAB' }
  | { type: 'CLOSE_TAB'; tabId: string }
  | { type: 'SET_ACTIVE_TAB'; tabId: string }
  | { type: 'UPDATE_REQUEST'; requestId: string; updates: Partial<RequestConfig> }
  | { type: 'SET_RESPONSE'; requestId: string; response: ResponseData | null }
  | { type: 'SET_LOADING'; requestId: string; loading: boolean }
  | { type: 'ADD_HISTORY'; entry: HistoryEntry }
  | { type: 'CLEAR_HISTORY' }
  | { type: 'ADD_COLLECTION'; collection: Collection }
  | { type: 'UPDATE_COLLECTION'; id: string; updates: Partial<Collection> }
  | { type: 'DELETE_COLLECTION'; id: string }
  | { type: 'SAVE_TO_COLLECTION'; collectionId: string; request: RequestConfig }
  | { type: 'ADD_ENVIRONMENT'; environment: Environment }
  | { type: 'UPDATE_ENVIRONMENT'; id: string; updates: Partial<Environment> }
  | { type: 'DELETE_ENVIRONMENT'; id: string }
  | { type: 'SET_ACTIVE_ENVIRONMENT'; id: string | null }
  | { type: 'TOGGLE_SIDEBAR' }
  | { type: 'SET_SIDEBAR_TAB'; tab: SidebarTab }
  | { type: 'OPEN_REQUEST'; request: RequestConfig }
  | { type: 'DUPLICATE_TAB'; tabId: string }
  | { type: 'ADD_TOKEN_PROFILE'; profile: TokenProfile }
  | { type: 'UPDATE_TOKEN_PROFILE'; id: string; updates: Partial<TokenProfile> }
  | { type: 'DELETE_TOKEN_PROFILE'; id: string }
  | { type: 'ADD_SNIPPET'; snippet: RequestSnippet }
  | { type: 'UPDATE_SNIPPET'; id: string; updates: Partial<RequestSnippet> }
  | { type: 'DELETE_SNIPPET'; id: string }
  | { type: 'SET_TEST_RESULTS'; requestId: string; tests: TestResult[]; console: ScriptConsoleEntry[] }
  | { type: 'ADD_SNAPSHOT'; snapshot: ResponseSnapshot }
  | { type: 'DELETE_SNAPSHOT'; id: string }
  | { type: 'SET_CHAIN_VARIABLE'; key: string; value: string };

function createFreshState(): AppState {
  const defaultReq = createDefaultRequest();
  const defaultTab: Tab = {
    id: generateId(),
    requestId: defaultReq.id,
    name: 'New Request',
    method: 'GET',
    isDirty: false,
  };
  const devEnvId = generateId();
  return {
    tabs: [defaultTab],
    activeTabId: defaultTab.id,
    requests: { [defaultReq.id]: defaultReq },
    responses: {},
    loading: {},
    history: [],
    collections: [
      {
        id: generateId(),
        name: 'Sample Collection',
        description: 'Example requests to get started',
        requests: [
          {
            ...createDefaultRequest(),
            name: 'Get Users',
            method: 'GET',
            url: 'https://jsonplaceholder.typicode.com/users',
          },
          {
            ...createDefaultRequest(),
            name: 'Create Post',
            method: 'POST',
            url: 'https://jsonplaceholder.typicode.com/posts',
            body: {
              type: 'json',
              content: JSON.stringify({ title: 'foo', body: 'bar', userId: 1 }, null, 2),
            },
            headers: [
              { id: generateId(), key: 'Content-Type', value: 'application/json', enabled: true },
            ],
          },
        ],
      },
    ],
    environments: [
      {
        id: devEnvId,
        name: 'Development',
        isActive: true,
        variables: [
          { id: generateId(), key: 'baseUrl', value: 'https://jsonplaceholder.typicode.com', enabled: true },
          { id: generateId(), key: 'apiKey', value: 'dev-key-123', enabled: true },
        ],
      },
      {
        id: generateId(),
        name: 'Production',
        isActive: false,
        variables: [
          { id: generateId(), key: 'baseUrl', value: 'https://api.production.com', enabled: true },
          { id: generateId(), key: 'apiKey', value: '', enabled: true },
        ],
      },
    ],
    activeEnvironmentId: devEnvId,
    sidebarOpen: true,
    sidebarTab: 'collections',
    tokenProfiles: [],
    snippets: [
      {
        id: generateId(), name: 'JSON Content Headers', category: 'headers', builtIn: true,
        headers: [
          { id: generateId(), key: 'Content-Type', value: 'application/json', enabled: true },
          { id: generateId(), key: 'Accept', value: 'application/json', enabled: true },
        ],
      },
      {
        id: generateId(), name: 'Pagination Params', category: 'params', builtIn: true,
        params: [
          { id: generateId(), key: 'page', value: '1', enabled: true },
          { id: generateId(), key: 'limit', value: '20', enabled: true },
        ],
      },
    ],
    testResults: {},
    scriptConsole: {},
    snapshots: [],
    chainVariables: {},
  };
}

function getInitialState(): AppState {
  const fresh = createFreshState();
  const saved = loadFromStorage();
  if (!saved) return fresh;

  // Merge saved data into fresh state, restoring persisted data
  // but keeping runtime state (responses, loading) fresh
  const restoredReq = createDefaultRequest();
  const restoredTab: Tab = {
    id: generateId(),
    requestId: restoredReq.id,
    name: 'New Request',
    method: 'GET',
    isDirty: false,
  };

  return {
    ...fresh,
    history: saved.history ?? fresh.history,
    collections: saved.collections ?? fresh.collections,
    environments: saved.environments ?? fresh.environments,
    activeEnvironmentId: saved.activeEnvironmentId ?? fresh.activeEnvironmentId,
    tokenProfiles: saved.tokenProfiles ?? fresh.tokenProfiles,
    // Restore tabs and requests if available, otherwise create fresh
    tabs: saved.tabs?.length ? saved.tabs : [restoredTab],
    activeTabId: saved.tabs?.length ? saved.tabs[0].id : restoredTab.id,
    requests: saved.requests && Object.keys(saved.requests).length > 0
      ? saved.requests
      : { [restoredReq.id]: restoredReq },
    responses: {},
    loading: {},
    snippets: (saved as Partial<AppState>).snippets ?? fresh.snippets,
    snapshots: (saved as Partial<AppState>).snapshots ?? fresh.snapshots,
    testResults: {},
    scriptConsole: {},
    chainVariables: {},
  };
}

const initialState = getInitialState();

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'NEW_TAB': {
      const req = createDefaultRequest();
      const tab: Tab = {
        id: generateId(),
        requestId: req.id,
        name: 'New Request',
        method: 'GET',
        isDirty: false,
      };
      return {
        ...state,
        tabs: [...state.tabs, tab],
        activeTabId: tab.id,
        requests: { ...state.requests, [req.id]: req },
      };
    }
    case 'CLOSE_TAB': {
      const remaining = state.tabs.filter(t => t.id !== action.tabId);
      if (remaining.length === 0) {
        const req = createDefaultRequest();
        const tab: Tab = { id: generateId(), requestId: req.id, name: 'New Request', method: 'GET', isDirty: false };
        return { ...state, tabs: [tab], activeTabId: tab.id, requests: { ...state.requests, [req.id]: req } };
      }
      const newActive = state.activeTabId === action.tabId
        ? remaining[Math.min(state.tabs.findIndex(t => t.id === action.tabId), remaining.length - 1)].id
        : state.activeTabId;
      return { ...state, tabs: remaining, activeTabId: newActive };
    }
    case 'SET_ACTIVE_TAB':
      return { ...state, activeTabId: action.tabId };
    case 'UPDATE_REQUEST': {
      const req = { ...state.requests[action.requestId], ...action.updates };
      const tabs = state.tabs.map(t =>
        t.requestId === action.requestId
          ? { ...t, name: req.name || req.url || 'New Request', method: req.method, isDirty: true }
          : t
      );
      return { ...state, requests: { ...state.requests, [action.requestId]: req }, tabs };
    }
    case 'SET_RESPONSE':
      return { ...state, responses: { ...state.responses, [action.requestId]: action.response } };
    case 'SET_LOADING':
      return { ...state, loading: { ...state.loading, [action.requestId]: action.loading } };
    case 'ADD_HISTORY':
      return { ...state, history: [action.entry, ...state.history].slice(0, 100) };
    case 'CLEAR_HISTORY':
      return { ...state, history: [] };
    case 'ADD_COLLECTION':
      return { ...state, collections: [...state.collections, action.collection] };
    case 'UPDATE_COLLECTION':
      return {
        ...state,
        collections: state.collections.map(c =>
          c.id === action.id ? { ...c, ...action.updates } : c
        ),
      };
    case 'DELETE_COLLECTION':
      return { ...state, collections: state.collections.filter(c => c.id !== action.id) };
    case 'SAVE_TO_COLLECTION':
      return {
        ...state,
        collections: state.collections.map(c =>
          c.id === action.collectionId
            ? { ...c, requests: [...c.requests, { ...action.request, id: generateId() }] }
            : c
        ),
      };
    case 'ADD_ENVIRONMENT':
      return { ...state, environments: [...state.environments, action.environment] };
    case 'UPDATE_ENVIRONMENT':
      return {
        ...state,
        environments: state.environments.map(e =>
          e.id === action.id ? { ...e, ...action.updates } : e
        ),
      };
    case 'DELETE_ENVIRONMENT':
      return {
        ...state,
        environments: state.environments.filter(e => e.id !== action.id),
        activeEnvironmentId: state.activeEnvironmentId === action.id ? null : state.activeEnvironmentId,
      };
    case 'SET_ACTIVE_ENVIRONMENT':
      return { ...state, activeEnvironmentId: action.id };
    case 'TOGGLE_SIDEBAR':
      return { ...state, sidebarOpen: !state.sidebarOpen };
    case 'SET_SIDEBAR_TAB':
      return { ...state, sidebarTab: action.tab, sidebarOpen: true };
    case 'OPEN_REQUEST': {
      const existing = state.tabs.find(t => state.requests[t.requestId]?.url === action.request.url && state.requests[t.requestId]?.method === action.request.method);
      if (existing) return { ...state, activeTabId: existing.id };
      const req = { ...action.request, id: generateId() };
      const tab: Tab = { id: generateId(), requestId: req.id, name: req.name || req.url, method: req.method, isDirty: false };
      return { ...state, tabs: [...state.tabs, tab], activeTabId: tab.id, requests: { ...state.requests, [req.id]: req } };
    }
    case 'DUPLICATE_TAB': {
      const srcTab = state.tabs.find(t => t.id === action.tabId);
      if (!srcTab) return state;
      const srcReq = state.requests[srcTab.requestId];
      const req = { ...srcReq, id: generateId(), name: srcReq.name + ' (copy)' };
      const tab: Tab = { id: generateId(), requestId: req.id, name: req.name, method: req.method, isDirty: false };
      return { ...state, tabs: [...state.tabs, tab], activeTabId: tab.id, requests: { ...state.requests, [req.id]: req } };
    }
    case 'ADD_TOKEN_PROFILE':
      return { ...state, tokenProfiles: [...state.tokenProfiles, action.profile] };
    case 'UPDATE_TOKEN_PROFILE':
      return {
        ...state,
        tokenProfiles: state.tokenProfiles.map(p =>
          p.id === action.id ? { ...p, ...action.updates } : p
        ),
      };
    case 'DELETE_TOKEN_PROFILE':
      return { ...state, tokenProfiles: state.tokenProfiles.filter(p => p.id !== action.id) };
    case 'ADD_SNIPPET':
      return { ...state, snippets: [...state.snippets, action.snippet] };
    case 'UPDATE_SNIPPET':
      return { ...state, snippets: state.snippets.map(s => s.id === action.id ? { ...s, ...action.updates } : s) };
    case 'DELETE_SNIPPET':
      return { ...state, snippets: state.snippets.filter(s => s.id !== action.id) };
    case 'SET_TEST_RESULTS':
      return {
        ...state,
        testResults: { ...state.testResults, [action.requestId]: action.tests },
        scriptConsole: { ...state.scriptConsole, [action.requestId]: action.console },
      };
    case 'ADD_SNAPSHOT':
      return { ...state, snapshots: [action.snapshot, ...state.snapshots].slice(0, 50) };
    case 'DELETE_SNAPSHOT':
      return { ...state, snapshots: state.snapshots.filter(s => s.id !== action.id) };
    case 'SET_CHAIN_VARIABLE':
      return { ...state, chainVariables: { ...state.chainVariables, [action.key]: action.value } };
    default:
      return state;
  }
}

interface AppContextValue {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  sendRequest: (requestId: string) => Promise<void>;
  fetchOAuth2Token: (requestId: string) => Promise<void>;
  fetchTokenProfile: (profileId: string) => Promise<void>;
  getEnvVariables: () => Record<string, string>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Persist state to localStorage on every change
  useEffect(() => {
    saveToStorage(state);
  }, [state]);

  const getEnvVariables = useCallback(() => {
    const env = state.environments.find(e => e.id === state.activeEnvironmentId);
    if (!env) return {};
    const vars: Record<string, string> = {};
    env.variables.filter(v => v.enabled && v.key).forEach(v => { vars[v.key] = v.value; });
    return vars;
  }, [state.environments, state.activeEnvironmentId]);

  const fetchTokenProfile = useCallback(async (profileId: string) => {
    const profile = state.tokenProfiles.find(p => p.id === profileId);
    if (!profile) return;

    dispatch({ type: 'UPDATE_TOKEN_PROFILE', id: profileId, updates: { status: 'fetching', error: undefined } });

    const vars = getEnvVariables();
    const resolveVars = (s: string) => s.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? `{{${k}}}`);

    try {
      const fetchHeaders: Record<string, string> = {};
      profile.headers.filter(h => h.enabled && h.key).forEach(h => {
        fetchHeaders[resolveVars(h.key)] = resolveVars(h.value);
      });

      let fetchBody: string | undefined;
      if (profile.method === 'POST') {
        if (profile.bodyType === 'json') {
          fetchHeaders['Content-Type'] = fetchHeaders['Content-Type'] || 'application/json';
          fetchBody = resolveVars(profile.bodyContent);
        } else if (profile.bodyType === 'x-www-form-urlencoded') {
          fetchHeaders['Content-Type'] = 'application/x-www-form-urlencoded';
          const form = new URLSearchParams();
          profile.bodyFormData.filter(f => f.enabled && f.key).forEach(f => {
            form.set(resolveVars(f.key), resolveVars(f.value));
          });
          fetchBody = form.toString();
        }
      }

      const res = await fetch(resolveVars(profile.tokenEndpoint), {
        method: profile.method,
        headers: fetchHeaders,
        body: fetchBody,
      });

      if (!res.ok) {
        const errText = await res.text();
        dispatch({
          type: 'UPDATE_TOKEN_PROFILE',
          id: profileId,
          updates: { status: 'error', error: `HTTP ${res.status}: ${errText.substring(0, 200)}` },
        });
        return;
      }

      const data = await res.json();

      const token = extractByPath(data, profile.tokenPath);
      if (!token || typeof token !== 'string') {
        dispatch({
          type: 'UPDATE_TOKEN_PROFILE',
          id: profileId,
          updates: { status: 'error', error: `Token not found at path "${profile.tokenPath}" in response` },
        });
        return;
      }

      let tokenExpiry: number | undefined;
      if (profile.expiresInPath) {
        const expiresIn = extractByPath(data, profile.expiresInPath);
        if (typeof expiresIn === 'number') {
          tokenExpiry = Date.now() + expiresIn * 1000;
        }
      }

      dispatch({
        type: 'UPDATE_TOKEN_PROFILE',
        id: profileId,
        updates: {
          currentToken: token,
          tokenExpiry,
          lastFetched: Date.now(),
          status: 'active',
          error: undefined,
        },
      });
    } catch (err) {
      dispatch({
        type: 'UPDATE_TOKEN_PROFILE',
        id: profileId,
        updates: {
          status: 'error',
          error: err instanceof Error ? err.message : 'Failed to fetch token',
        },
      });
    }
  }, [state.tokenProfiles, getEnvVariables]);

  const fetchOAuth2Token = useCallback(async (requestId: string) => {
    const request = state.requests[requestId];
    if (!request || request.auth.type !== 'oauth2' || !request.auth.oauth2) return;

    const oauth = request.auth.oauth2;
    const params = new URLSearchParams();
    params.set('grant_type', oauth.grantType === 'authorization_code' ? 'authorization_code' : oauth.grantType);
    params.set('client_id', oauth.clientId);
    params.set('client_secret', oauth.clientSecret);
    if (oauth.scope) params.set('scope', oauth.scope);
    if (oauth.grantType === 'password') {
      params.set('username', oauth.username || '');
      params.set('password', oauth.password || '');
    }

    try {
      const res = await fetch(oauth.tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params,
      });
      const data = await res.json();
      dispatch({
        type: 'UPDATE_REQUEST',
        requestId,
        updates: {
          auth: {
            ...request.auth,
            oauth2: {
              ...oauth,
              accessToken: data.access_token,
              refreshToken: data.refresh_token || oauth.refreshToken,
              tokenExpiry: data.expires_in ? Date.now() + data.expires_in * 1000 : undefined,
            },
          },
        },
      });
    } catch (err) {
      console.error('Token fetch failed:', err);
    }
  }, [state.requests]);

  const sendRequest = useCallback(async (requestId: string) => {
    const request = state.requests[requestId];
    if (!request || !request.url) return;

    dispatch({ type: 'SET_LOADING', requestId, loading: true });
    dispatch({ type: 'SET_RESPONSE', requestId, response: null });

    const vars = { ...getEnvVariables(), ...state.chainVariables };
    const resolveVars = (s: string) => s.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? `{{${k}}}`);

    // Run pre-request script
    if (request.preRequestScript) {
      const scriptResult = runPreRequestScript(request.preRequestScript, {
        url: request.url, method: request.method,
        headers: Object.fromEntries(request.headers.filter(h => h.enabled && h.key).map(h => [h.key, h.value])),
        body: request.body.content, variables: vars,
      });
      // Apply script-set variables
      Object.entries(scriptResult.variables).forEach(([k, v]) => {
        if (!(k in vars)) vars[k] = v;
        dispatch({ type: 'SET_CHAIN_VARIABLE', key: k, value: v });
      });
      // Apply script-set headers
      Object.entries(scriptResult.headers).forEach(([k, v]) => {
        const existing = request.headers.find(h => h.key === k);
        if (!existing) {
          dispatch({ type: 'UPDATE_REQUEST', requestId, updates: {
            headers: [...request.headers, { id: generateId(), key: k, value: v, enabled: true }]
          }});
        }
      });
      if (scriptResult.console.length > 0) {
        dispatch({ type: 'SET_TEST_RESULTS', requestId, tests: [], console: scriptResult.console });
      }
    }

    // Auto-refresh OAuth2 token
    if (request.auth.type === 'oauth2' && request.auth.oauth2?.autoRefresh) {
      const oauth = request.auth.oauth2;
      if (!oauth.accessToken || (oauth.tokenExpiry && Date.now() > oauth.tokenExpiry - 30000)) {
        await fetchOAuth2Token(requestId);
      }
    }

    // Auto-fetch token profile if needed
    if (request.auth.type === 'token-profile' && request.auth.tokenProfileId) {
      const profile = state.tokenProfiles.find(p => p.id === request.auth.tokenProfileId);
      if (profile) {
        const needsRefresh = !profile.currentToken
          || profile.status === 'error'
          || profile.status === 'idle'
          || (profile.tokenExpiry && Date.now() > profile.tokenExpiry - profile.refreshBeforeExpirySec * 1000);
        if (needsRefresh && profile.autoRefresh) {
          await fetchTokenProfile(profile.id);
        }
      }
    }

    // Re-read state after possible token refreshes
    const freshRequest = state.requests[requestId] || request;
    let url = resolveVars(freshRequest.url);
    const enabledParams = freshRequest.params.filter(p => p.enabled && p.key);
    if (enabledParams.length > 0) {
      const sp = new URLSearchParams();
      enabledParams.forEach(p => sp.set(resolveVars(p.key), resolveVars(p.value)));
      url += (url.includes('?') ? '&' : '?') + sp.toString();
    }

    // Auth query params
    if (freshRequest.auth.type === 'api-key' && freshRequest.auth.apiKey?.addTo === 'query') {
      const sep = url.includes('?') ? '&' : '?';
      url += `${sep}${encodeURIComponent(freshRequest.auth.apiKey.key)}=${encodeURIComponent(freshRequest.auth.apiKey.value)}`;
    }

    const headers: Record<string, string> = {};
    freshRequest.headers.filter(h => h.enabled && h.key).forEach(h => {
      headers[resolveVars(h.key)] = resolveVars(h.value);
    });

    // Auth headers
    if (freshRequest.auth.type === 'bearer' && freshRequest.auth.bearer?.token) {
      headers['Authorization'] = `Bearer ${resolveVars(freshRequest.auth.bearer.token)}`;
    } else if (freshRequest.auth.type === 'basic' && freshRequest.auth.basic) {
      headers['Authorization'] = `Basic ${btoa(`${freshRequest.auth.basic.username}:${freshRequest.auth.basic.password}`)}`;
    } else if (freshRequest.auth.type === 'api-key' && freshRequest.auth.apiKey?.addTo === 'header') {
      headers[freshRequest.auth.apiKey.key] = freshRequest.auth.apiKey.value;
    } else if (freshRequest.auth.type === 'oauth2' && freshRequest.auth.oauth2?.accessToken) {
      headers['Authorization'] = `Bearer ${freshRequest.auth.oauth2.accessToken}`;
    } else if (freshRequest.auth.type === 'token-profile' && freshRequest.auth.tokenProfileId) {
      // Inject token from profile
      const profile = state.tokenProfiles.find(p => p.id === freshRequest.auth.tokenProfileId);
      if (profile?.currentToken) {
        const tokenValue = profile.tokenPrefix
          ? `${profile.tokenPrefix} ${profile.currentToken}`
          : profile.currentToken;
        if (profile.injectAs === 'header') {
          headers[profile.injectKey] = tokenValue;
        } else if (profile.injectAs === 'query') {
          const sep = url.includes('?') ? '&' : '?';
          url += `${sep}${encodeURIComponent(profile.injectKey)}=${encodeURIComponent(tokenValue)}`;
        }
      }
    }

    let body: string | FormData | undefined;
    if (!['GET', 'HEAD'].includes(freshRequest.method)) {
      if (freshRequest.body.type === 'json') {
        headers['Content-Type'] = headers['Content-Type'] || 'application/json';
        body = resolveVars(freshRequest.body.content);
      } else if (freshRequest.body.type === 'raw') {
        body = resolveVars(freshRequest.body.content);
      } else if (freshRequest.body.type === 'x-www-form-urlencoded') {
        headers['Content-Type'] = 'application/x-www-form-urlencoded';
        const form = new URLSearchParams();
        freshRequest.body.formData?.filter(f => f.enabled && f.key).forEach(f => {
          form.set(resolveVars(f.key), resolveVars(f.value));
        });
        body = form.toString();
      } else if (freshRequest.body.type === 'form-data') {
        const form = new FormData();
        freshRequest.body.formData?.filter(f => f.enabled && f.key).forEach(f => {
          form.set(resolveVars(f.key), resolveVars(f.value));
        });
        body = form;
      }
    }

    const startTime = performance.now();
    try {
      const res = await fetch(url, { method: freshRequest.method, headers, body });
      const elapsed = performance.now() - startTime;
      const text = await res.text();
      const resHeaders: Record<string, string> = {};
      res.headers.forEach((v, k) => { resHeaders[k] = v; });

      const response: ResponseData = {
        status: res.status,
        statusText: res.statusText,
        headers: resHeaders,
        body: text,
        size: new Blob([text]).size,
        time: elapsed,
        contentType: res.headers.get('content-type') || '',
      };

      dispatch({ type: 'SET_RESPONSE', requestId, response });
      dispatch({
        type: 'ADD_HISTORY',
        entry: { id: generateId(), request: freshRequest, response, timestamp: Date.now() },
      });

      // Run test script
      if (freshRequest.testScript) {
        const testResult = runTestScript(freshRequest.testScript, {
          response: { status: response.status, statusText: response.statusText, body: response.body, headers: response.headers, time: response.time },
          variables: vars,
        });
        dispatch({ type: 'SET_TEST_RESULTS', requestId, tests: testResult.tests, console: testResult.console });
        // Apply variables set by test script
        Object.entries(testResult.variables).forEach(([k, v]) => {
          if (!(k in vars)) dispatch({ type: 'SET_CHAIN_VARIABLE', key: k, value: v });
        });
      }

      // Response extractions
      if (freshRequest.responseExtractions?.length) {
        for (const extraction of freshRequest.responseExtractions) {
          if (!extraction.enabled || !extraction.variableName || !extraction.jsonPath) continue;
          let source: unknown;
          if (extraction.source === 'body') {
            try { source = JSON.parse(response.body); } catch { source = response.body; }
          } else {
            source = response.headers;
          }
          const value = extractByPath(source, extraction.jsonPath);
          if (value !== undefined) {
            dispatch({ type: 'SET_CHAIN_VARIABLE', key: extraction.variableName, value: String(value) });
          }
        }
      }
    } catch (err: unknown) {
      const elapsed = performance.now() - startTime;
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      dispatch({
        type: 'SET_RESPONSE',
        requestId,
        response: {
          status: 0,
          statusText: 'Error',
          headers: {},
          body: `Request failed: ${errorMsg}\n\nThis could be due to:\n• CORS restrictions\n• Network connectivity issues\n• Invalid URL\n• Server not responding`,
          size: 0,
          time: elapsed,
          contentType: 'text/plain',
        },
      });
    } finally {
      dispatch({ type: 'SET_LOADING', requestId, loading: false });
    }
  }, [state.requests, state.tokenProfiles, getEnvVariables, fetchOAuth2Token, fetchTokenProfile]);

  return (
    <AppContext.Provider value={{ state, dispatch, sendRequest, fetchOAuth2Token, fetchTokenProfile, getEnvVariables }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
