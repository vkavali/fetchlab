import { LlmProvider, LlmError } from './provider.js';

const DEFAULT_MODEL = 'anthropic.claude-3-5-sonnet-20241022-v2:0';

// AWS Bedrock provider for Claude (and other Bedrock-hosted Anthropic models).
// Uses @aws-sdk/client-bedrock-runtime, which is loaded lazily so the dependency
// is only required when the provider is actually used.
export class BedrockProvider extends LlmProvider {
  get name() { return 'bedrock'; }

  async _getClient() {
    if (this._client) return this._client;
    let mod;
    try {
      mod = await import('@aws-sdk/client-bedrock-runtime');
    } catch (err) {
      throw new LlmError(
        '@aws-sdk/client-bedrock-runtime is not installed. Run `npm install @aws-sdk/client-bedrock-runtime`.',
        { status: 503, provider: 'bedrock', cause: err }
      );
    }
    const { BedrockRuntimeClient } = mod;
    const region = this.config.region || process.env.AWS_REGION || 'us-east-1';
    const accessKeyId = this.config.accessKeyId || process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = this.config.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY;
    const sessionToken = this.config.sessionToken || process.env.AWS_SESSION_TOKEN;

    const clientOpts = { region };
    if (accessKeyId && secretAccessKey) {
      clientOpts.credentials = { accessKeyId, secretAccessKey };
      if (sessionToken) clientOpts.credentials.sessionToken = sessionToken;
    }
    this._client = new BedrockRuntimeClient(clientOpts);
    this._mod = mod;
    return this._client;
  }

  async chat(messages, options = {}) {
    const client = await this._getClient();
    const { InvokeModelCommand } = this._mod;
    const modelId = options.model || this.config.modelId || process.env.BEDROCK_MODEL_ID || DEFAULT_MODEL;
    const { system, messages: rest } = LlmProvider.splitSystem(messages);
    const systemPrompt = options.system || system;

    const body = {
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: options.maxTokens ?? 1024,
      messages: rest.map(m => ({ role: m.role, content: m.content })),
    };
    if (systemPrompt) body.system = systemPrompt;
    if (typeof options.temperature === 'number') body.temperature = options.temperature;

    const cmd = new InvokeModelCommand({
      modelId,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(body),
    });

    let resp;
    try {
      resp = await client.send(cmd);
    } catch (err) {
      throw new LlmError(err.message || 'Bedrock invoke failed', {
        status: err.$metadata?.httpStatusCode || 502,
        provider: 'bedrock',
        cause: err,
      });
    }
    const payload = JSON.parse(new TextDecoder().decode(resp.body));
    const content = Array.isArray(payload.content)
      ? payload.content.filter(c => c.type === 'text').map(c => c.text).join('\n')
      : '';
    return {
      content,
      usage: {
        input_tokens: payload.usage?.input_tokens ?? 0,
        output_tokens: payload.usage?.output_tokens ?? 0,
        model: modelId,
        provider: 'bedrock',
      },
    };
  }
}

export default BedrockProvider;
