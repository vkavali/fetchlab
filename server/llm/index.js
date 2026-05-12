import { LlmError } from './provider.js';
import { AnthropicProvider } from './anthropic.js';
import { BedrockProvider } from './bedrock.js';
import { VertexProvider } from './vertex.js';
import { OpenAICompatProvider } from './openai-compat.js';
import { LocalProvider } from './local.js';

export { LlmError } from './provider.js';

export const PROVIDER_TYPES = ['anthropic', 'bedrock', 'vertex', 'openai', 'local'];

function pickDefaultProvider() {
  const explicit = (process.env.LLM_PROVIDER || '').toLowerCase();
  if (explicit && PROVIDER_TYPES.includes(explicit)) return explicit;
  if (process.env.ANTHROPIC_API_KEY) return 'anthropic';
  if (process.env.AWS_ACCESS_KEY_ID && process.env.BEDROCK_MODEL_ID) return 'bedrock';
  if (process.env.VERTEX_PROJECT_ID) return 'vertex';
  if (process.env.OPENAI_API_KEY) return 'openai';
  return 'local';
}

export function buildProvider(provider, config = {}) {
  const type = (provider || pickDefaultProvider()).toLowerCase();
  switch (type) {
    case 'anthropic': return new AnthropicProvider(config);
    case 'bedrock':   return new BedrockProvider(config);
    case 'vertex':    return new VertexProvider(config);
    case 'openai':    return new OpenAICompatProvider(config);
    case 'local':     return new LocalProvider(config);
    default:
      throw new LlmError(`Unknown LLM provider: ${type}`, { status: 400, provider: type });
  }
}

// Returns a provider for a given user, falling back to the server default.
// `userConfig` is the row from `llm_configs` (already decrypted) — or null if
// the user has no BYOK config.
export function providerForUser(userConfig) {
  if (userConfig && userConfig.provider) {
    return buildProvider(userConfig.provider, normalizeUserConfig(userConfig));
  }
  return defaultProvider();
}

let _defaultProvider = null;
export function defaultProvider() {
  if (_defaultProvider) return _defaultProvider;
  _defaultProvider = buildProvider(pickDefaultProvider());
  return _defaultProvider;
}

// Called from tests to reset cached default provider after env changes.
export function _resetProviderCache() {
  _defaultProvider = null;
}

export function describeDefaultProvider() {
  const type = pickDefaultProvider();
  return {
    provider: type,
    configured: type !== 'local' || !!process.env.ANTHROPIC_API_KEY,
  };
}

function normalizeUserConfig(row) {
  return {
    apiKey: row.api_key,
    baseUrl: row.base_url,
    model: row.model_id,
    modelId: row.model_id,
    region: row.region,
    projectId: row.project_id,
    location: row.location,
    credentialsJson: row.extra_config?.credentials_json || row.credentials_json,
    accessKeyId: row.extra_config?.aws_access_key_id || row.api_key,
    secretAccessKey: row.extra_config?.aws_secret_access_key,
    sessionToken: row.extra_config?.aws_session_token,
    extraHeaders: row.extra_config?.extra_headers,
    ...row.extra_config,
  };
}
