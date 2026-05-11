import { LlmProvider, LlmError } from './provider.js';

const DEFAULT_BASE_URL = 'https://api.openai.com/v1';
const DEFAULT_MODEL = 'gpt-4o-mini';

// OpenAI-compatible chat completions provider. Works with OpenAI, Azure OpenAI
// (with the right base URL + api-version), Ollama (http://localhost:11434/v1),
// vLLM, Together, Groq, and anything else exposing /chat/completions.
export class OpenAICompatProvider extends LlmProvider {
  get name() { return 'openai'; }

  async chat(messages, options = {}) {
    const apiKey = this.config.apiKey || process.env.OPENAI_API_KEY;
    const baseUrl = (this.config.baseUrl || process.env.OPENAI_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, '');
    const model = options.model || this.config.model || process.env.OPENAI_MODEL || DEFAULT_MODEL;
    const requireKey = !this.config.allowMissingKey;
    if (requireKey && !apiKey) {
      throw new LlmError('OpenAI API key not configured', { status: 503, provider: 'openai' });
    }

    // OpenAI accepts a system message as a role; if the caller passed `options.system`
    // explicitly, prepend it as a system role message.
    const allMessages = [];
    if (options.system) allMessages.push({ role: 'system', content: options.system });
    for (const m of messages || []) allMessages.push({ role: m.role, content: m.content });

    const body = {
      model,
      messages: allMessages,
      max_tokens: options.maxTokens ?? 1024,
    };
    if (typeof options.temperature === 'number') body.temperature = options.temperature;

    const headers = { 'Content-Type': 'application/json' };
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
    if (this.config.extraHeaders) Object.assign(headers, this.config.extraHeaders);

    const fetchImpl = options.fetchImpl || this.config.fetchImpl || fetch;
    const url = `${baseUrl}/chat/completions`;
    const res = await fetchImpl(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new LlmError(
        data?.error?.message || `OpenAI-compatible error ${res.status}`,
        { status: res.status, provider: 'openai' }
      );
    }
    const choice = data.choices?.[0];
    const content = choice?.message?.content || '';
    return {
      content: typeof content === 'string' ? content : JSON.stringify(content),
      usage: {
        input_tokens: data.usage?.prompt_tokens ?? 0,
        output_tokens: data.usage?.completion_tokens ?? 0,
        model: data.model || model,
        provider: 'openai',
      },
    };
  }
}

export default OpenAICompatProvider;
