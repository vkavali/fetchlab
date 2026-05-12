import { LlmProvider, LlmError } from './provider.js';

const DEFAULT_MODEL = 'claude-sonnet-4-6';
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

export class AnthropicProvider extends LlmProvider {
  get name() { return 'anthropic'; }

  async chat(messages, options = {}) {
    const apiKey = this.config.apiKey || process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new LlmError('Anthropic API key not configured', { status: 503, provider: 'anthropic' });
    }
    const model = options.model || this.config.model || DEFAULT_MODEL;
    const { system, messages: rest } = LlmProvider.splitSystem(messages);
    const systemPrompt = options.system || system;

    const body = {
      model,
      max_tokens: options.maxTokens ?? 1024,
      messages: rest.map(m => ({ role: m.role, content: m.content })),
    };
    if (systemPrompt) body.system = systemPrompt;
    if (typeof options.temperature === 'number') body.temperature = options.temperature;

    const fetchImpl = options.fetchImpl || this.config.fetchImpl || fetch;
    const res = await fetchImpl(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new LlmError(
        data?.error?.message || `Anthropic error ${res.status}`,
        { status: res.status, provider: 'anthropic' }
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
        model: data.model || model,
        provider: 'anthropic',
      },
    };
  }
}

export default AnthropicProvider;
