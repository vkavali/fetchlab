// Abstract LLM provider interface. Every provider implements `chat(messages, options)`
// returning `{ content, usage }` where:
//   messages: [{ role: 'system' | 'user' | 'assistant', content: string }]
//   options:  { model?, maxTokens?, temperature?, system? }
//   content:  the text response from the model
//   usage:    { input_tokens, output_tokens, model, provider }
//
// Concrete providers should split out the system message themselves when their
// API needs it as a separate field (e.g. Anthropic). The OpenAI-compat provider
// can pass system through as a `role: 'system'` message.

export class LlmError extends Error {
  constructor(message, { status, provider, cause } = {}) {
    super(message);
    this.name = 'LlmError';
    this.status = status || 500;
    this.provider = provider;
    if (cause) this.cause = cause;
  }
}

export class LlmProvider {
  constructor(config = {}) {
    this.config = config;
  }

  async chat(_messages, _options = {}) {
    throw new LlmError('chat() not implemented', { provider: this.name });
  }

  get name() {
    return 'abstract';
  }

  // Helper that splits messages into a system string + non-system messages.
  static splitSystem(messages) {
    const sys = [];
    const rest = [];
    for (const m of messages || []) {
      if (m.role === 'system') sys.push(m.content);
      else rest.push(m);
    }
    return { system: sys.length ? sys.join('\n\n') : null, messages: rest };
  }
}
