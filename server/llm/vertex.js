import { LlmProvider, LlmError } from './provider.js';

const DEFAULT_MODEL = 'claude-sonnet-4-6@20250514';
const DEFAULT_LOCATION = 'us-east5';

// Google Vertex AI provider for Claude. Uses google-auth-library to obtain an
// access token from Application Default Credentials or an explicit service
// account JSON in config.credentialsJson.
export class VertexProvider extends LlmProvider {
  get name() { return 'vertex'; }

  async _getToken() {
    let GoogleAuth;
    try {
      ({ GoogleAuth } = await import('google-auth-library'));
    } catch (err) {
      throw new LlmError(
        'google-auth-library is not installed. Run `npm install google-auth-library`.',
        { status: 503, provider: 'vertex', cause: err }
      );
    }
    const scopes = ['https://www.googleapis.com/auth/cloud-platform'];
    let auth;
    if (this.config.credentialsJson) {
      const creds = typeof this.config.credentialsJson === 'string'
        ? JSON.parse(this.config.credentialsJson)
        : this.config.credentialsJson;
      auth = new GoogleAuth({ credentials: creds, scopes });
    } else {
      auth = new GoogleAuth({ scopes });
    }
    const client = await auth.getClient();
    const tokenRes = await client.getAccessToken();
    return tokenRes?.token || tokenRes;
  }

  async chat(messages, options = {}) {
    const projectId = this.config.projectId || process.env.VERTEX_PROJECT_ID;
    if (!projectId) {
      throw new LlmError('Vertex project ID not configured (VERTEX_PROJECT_ID)', { status: 503, provider: 'vertex' });
    }
    const location = this.config.location || process.env.VERTEX_LOCATION || DEFAULT_LOCATION;
    const modelId = options.model || this.config.modelId || process.env.VERTEX_MODEL_ID || DEFAULT_MODEL;
    const { system, messages: rest } = LlmProvider.splitSystem(messages);
    const systemPrompt = options.system || system;

    const body = {
      anthropic_version: 'vertex-2023-10-16',
      max_tokens: options.maxTokens ?? 1024,
      messages: rest.map(m => ({ role: m.role, content: m.content })),
    };
    if (systemPrompt) body.system = systemPrompt;
    if (typeof options.temperature === 'number') body.temperature = options.temperature;

    const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/anthropic/models/${encodeURIComponent(modelId)}:rawPredict`;
    const token = await this._getToken();
    const fetchImpl = options.fetchImpl || this.config.fetchImpl || fetch;
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new LlmError(
        data?.error?.message || `Vertex error ${res.status}`,
        { status: res.status, provider: 'vertex' }
      );
    }
    const content = Array.isArray(data.content)
      ? data.content.filter(c => c.type === 'text').map(c => c.text).join('\n')
      : '';
    return {
      content,
      usage: {
        input_tokens: data.usage?.input_tokens ?? 0,
        output_tokens: data.usage?.output_tokens ?? 0,
        model: modelId,
        provider: 'vertex',
      },
    };
  }
}

export default VertexProvider;
