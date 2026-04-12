export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

export interface KeyValue {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
  description?: string;
}

export interface TokenProfile {
  id: string;
  name: string;
  tokenEndpoint: string;
  method: 'GET' | 'POST';
  authType: 'body' | 'header' | 'query';
  headers: KeyValue[];
  bodyType: 'json' | 'x-www-form-urlencoded' | 'none';
  bodyContent: string;
  bodyFormData: KeyValue[];
  tokenPath: string; // JSONPath-like to extract token, e.g. "access_token" or "data.token"
  expiresInPath?: string; // JSONPath-like to extract expiry, e.g. "expires_in"
  tokenPrefix: string; // e.g. "Bearer"
  injectAs: 'header' | 'query';
  injectKey: string; // e.g. "Authorization" for header or "token" for query
  // Runtime state
  currentToken?: string;
  tokenExpiry?: number;
  lastFetched?: number;
  status: 'idle' | 'fetching' | 'active' | 'expired' | 'error';
  error?: string;
  autoRefresh: boolean;
  refreshBeforeExpirySec: number; // seconds before expiry to auto-refresh
}

export interface AuthConfig {
  type: 'none' | 'bearer' | 'basic' | 'api-key' | 'oauth2' | 'token-profile';
  bearer?: { token: string };
  basic?: { username: string; password: string };
  apiKey?: { key: string; value: string; addTo: 'header' | 'query' };
  oauth2?: {
    grantType: 'authorization_code' | 'client_credentials' | 'password';
    tokenUrl: string;
    authUrl?: string;
    clientId: string;
    clientSecret: string;
    scope?: string;
    username?: string;
    password?: string;
    accessToken?: string;
    refreshToken?: string;
    tokenExpiry?: number;
    autoRefresh: boolean;
  };
  tokenProfileId?: string; // reference to a TokenProfile
}

export interface RequestConfig {
  id: string;
  name: string;
  method: HttpMethod;
  url: string;
  params: KeyValue[];
  headers: KeyValue[];
  body: {
    type: 'none' | 'json' | 'form-data' | 'x-www-form-urlencoded' | 'raw' | 'binary';
    content: string;
    formData?: KeyValue[];
  };
  auth: AuthConfig;
  preRequestScript?: string;
  testScript?: string;
  responseExtractions?: ResponseExtraction[];
}

export interface ResponseData {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  size: number;
  time: number;
  contentType: string;
}

export interface HistoryEntry {
  id: string;
  request: RequestConfig;
  response: ResponseData | null;
  timestamp: number;
}

export interface Collection {
  id: string;
  name: string;
  description?: string;
  requests: RequestConfig[];
  folders?: Collection[];
}

export interface Environment {
  id: string;
  name: string;
  variables: KeyValue[];
  isActive: boolean;
}

export type Tab = {
  id: string;
  requestId: string;
  name: string;
  method: HttpMethod;
  isDirty: boolean;
};

// === Feature: Request Snippets ===
export interface RequestSnippet {
  id: string;
  name: string;
  description?: string;
  category: 'headers' | 'params' | 'body' | 'auth' | 'full';
  headers?: KeyValue[];
  params?: KeyValue[];
  body?: { type: RequestConfig['body']['type']; content: string; formData?: KeyValue[] };
  auth?: AuthConfig;
  color?: string;
  builtIn?: boolean;
}

// === Feature: Test Scripts ===
export interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

export interface ScriptConsoleEntry {
  type: 'log' | 'warn' | 'error';
  args: string[];
}

// === Feature: Response Extraction / Chaining ===
export interface ResponseExtraction {
  id: string;
  variableName: string;
  jsonPath: string;
  source: 'body' | 'headers';
  enabled: boolean;
}

// === Feature: Response Snapshots / Diff ===
export interface ResponseSnapshot {
  id: string;
  name: string;
  requestMethod: HttpMethod;
  requestUrl: string;
  response: ResponseData;
  timestamp: number;
}
