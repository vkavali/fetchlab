import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { initDb, _resetForTests, getLlmConfig } from '../server/db.js';
import { resetKeyCache, decrypt } from '../server/encryption.js';
import {
  buildProvider,
  defaultProvider,
  describeDefaultProvider,
  _resetProviderCache,
  PROVIDER_TYPES,
  LlmError,
} from '../server/llm/index.js';
import { AnthropicProvider } from '../server/llm/anthropic.js';
import { OpenAICompatProvider } from '../server/llm/openai-compat.js';
import { LocalProvider } from '../server/llm/local.js';
import { BedrockProvider } from '../server/llm/bedrock.js';

let app;
let token;

beforeAll(async () => {
  process.env.JWT_SECRET = 'llm-test-secret-key-very-long';
  process.env.APP_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  process.env.ANTHROPIC_API_KEY = 'sk-ant-mock-llm-key';
  resetKeyCache();
  delete process.env.DATABASE_URL;
  delete process.env.FETCHLAB_DATA_FILE;
  delete process.env.LLM_PROVIDER;
  _resetProviderCache();
  await initDb();
  const { buildApp } = await import('../server/app.js');
  app = await buildApp({ skipDbInit: true });
});

beforeEach(async () => {
  _resetForTests();
  _resetProviderCache();
  const reg = await request(app)
    .post('/api/auth/register')
    .send({ email: 'byok@test.io', password: 'password123' });
  token = reg.body.token;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('LLM provider factory', () => {
  it('exposes the expected provider types', () => {
    expect(PROVIDER_TYPES).toEqual(['anthropic', 'bedrock', 'vertex', 'openai', 'local']);
  });

  it('buildProvider returns the right concrete class', () => {
    expect(buildProvider('anthropic')).toBeInstanceOf(AnthropicProvider);
    expect(buildProvider('openai')).toBeInstanceOf(OpenAICompatProvider);
    expect(buildProvider('local')).toBeInstanceOf(LocalProvider);
    expect(buildProvider('bedrock')).toBeInstanceOf(BedrockProvider);
  });

  it('throws LlmError for unknown providers', () => {
    expect(() => buildProvider('nonsense')).toThrow(LlmError);
  });

  it('default provider is anthropic when ANTHROPIC_API_KEY is set', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-mock-llm-key';
    delete process.env.LLM_PROVIDER;
    _resetProviderCache();
    expect(defaultProvider()).toBeInstanceOf(AnthropicProvider);
    expect(describeDefaultProvider().provider).toBe('anthropic');
  });

  it('default falls back to local when no env is set', () => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.VERTEX_PROJECT_ID;
    delete process.env.AWS_ACCESS_KEY_ID;
    delete process.env.LLM_PROVIDER;
    _resetProviderCache();
    expect(defaultProvider()).toBeInstanceOf(LocalProvider);
    process.env.ANTHROPIC_API_KEY = 'sk-ant-mock-llm-key';
    _resetProviderCache();
  });

  it('explicit LLM_PROVIDER env overrides auto-detection', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-mock-llm-key';
    process.env.LLM_PROVIDER = 'local';
    _resetProviderCache();
    expect(defaultProvider()).toBeInstanceOf(LocalProvider);
    delete process.env.LLM_PROVIDER;
    _resetProviderCache();
  });
});

describe('AnthropicProvider', () => {
  it('builds the correct Anthropic request and parses the response', async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        model: 'claude-sonnet-4-6',
        content: [{ type: 'text', text: 'Hello from Anthropic' }],
        usage: { input_tokens: 10, output_tokens: 20 },
      }),
    });
    const provider = new AnthropicProvider({ apiKey: 'sk-ant-test', fetchImpl: fakeFetch });
    const result = await provider.chat(
      [{ role: 'user', content: 'hi' }],
      { system: 'be helpful', maxTokens: 100 }
    );
    expect(result.content).toBe('Hello from Anthropic');
    expect(result.usage.input_tokens).toBe(10);
    expect(result.usage.provider).toBe('anthropic');
    const [url, opts] = fakeFetch.mock.calls[0];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect(opts.headers['x-api-key']).toBe('sk-ant-test');
    const body = JSON.parse(opts.body);
    expect(body.system).toBe('be helpful');
    expect(body.max_tokens).toBe(100);
    expect(body.messages[0].content).toBe('hi');
  });

  it('throws LlmError on API failure', async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({ error: { message: 'rate limited' } }),
    });
    const provider = new AnthropicProvider({ apiKey: 'sk-test', fetchImpl: fakeFetch });
    await expect(provider.chat([{ role: 'user', content: 'x' }])).rejects.toThrow(/rate limited/);
  });

  it('throws when no API key configured', async () => {
    const provider = new AnthropicProvider({});
    const old = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    await expect(provider.chat([{ role: 'user', content: 'x' }])).rejects.toThrow(/Anthropic API key/);
    process.env.ANTHROPIC_API_KEY = old;
  });
});

describe('OpenAICompatProvider', () => {
  it('sends OpenAI-shaped request and parses response', async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        model: 'gpt-4o-mini',
        choices: [{ message: { role: 'assistant', content: 'hi back' } }],
        usage: { prompt_tokens: 5, completion_tokens: 8 },
      }),
    });
    const provider = new OpenAICompatProvider({
      apiKey: 'sk-test',
      baseUrl: 'https://api.example.com/v1',
      fetchImpl: fakeFetch,
    });
    const result = await provider.chat(
      [{ role: 'user', content: 'hello' }],
      { system: 'sys-prompt' }
    );
    expect(result.content).toBe('hi back');
    expect(result.usage.input_tokens).toBe(5);
    expect(result.usage.provider).toBe('openai');
    const [url, opts] = fakeFetch.mock.calls[0];
    expect(url).toBe('https://api.example.com/v1/chat/completions');
    expect(opts.headers.Authorization).toBe('Bearer sk-test');
    const body = JSON.parse(opts.body);
    expect(body.messages[0].role).toBe('system');
    expect(body.messages[1].content).toBe('hello');
  });
});

describe('LocalProvider', () => {
  it('returns heuristic JSON for the generate-request system prompt', async () => {
    const provider = new LocalProvider();
    const result = await provider.chat(
      [{ role: 'user', content: 'POST to https://api.example.com/users with json body' }],
      { system: 'You are an HTTP request generator for the FetchLab API client' }
    );
    const parsed = JSON.parse(result.content);
    expect(parsed.method).toBe('POST');
    expect(parsed.url).toContain('https://api.example.com/users');
    expect(parsed.headers.some(h => h.key === 'Content-Type')).toBe(true);
  });

  it('returns heuristic diagnosis for the diagnose system prompt', async () => {
    const provider = new LocalProvider();
    const result = await provider.chat(
      [{ role: 'user', content: 'Diagnose this failed request:\n\n{ "status": 401 }' }],
      { system: 'You are an API debugging assistant' }
    );
    const parsed = JSON.parse(result.content);
    expect(parsed.summary).toMatch(/auth/i);
    expect(parsed.severity).toBeDefined();
  });

  it('makes no external HTTP calls', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const provider = new LocalProvider();
    await provider.chat([{ role: 'user', content: 'ping' }]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('BYOK API endpoints', () => {
  it('GET /api/settings/llm requires auth', async () => {
    const res = await request(app).get('/api/settings/llm');
    expect(res.status).toBe(401);
  });

  it('returns server default when user has no config', async () => {
    const res = await request(app)
      .get('/api/settings/llm')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.config).toBeNull();
    expect(res.body.active_source).toBe('server');
    expect(res.body.server_default.provider).toBe('anthropic');
  });

  it('PUT saves config with encrypted API key', async () => {
    const res = await request(app)
      .put('/api/settings/llm')
      .set('Authorization', `Bearer ${token}`)
      .send({
        provider: 'anthropic',
        api_key: 'sk-ant-user-secret',
        model_id: 'claude-sonnet-4-6',
      });
    expect(res.status).toBe(200);
    expect(res.body.config.provider).toBe('anthropic');
    expect(res.body.config.has_api_key).toBe(true);
    expect(res.body.config.api_key_preview).not.toBe('sk-ant-user-secret');
    expect(res.body.config.api_key_preview).toContain('••');
  });

  it('persists encrypted api_key, not plaintext', async () => {
    await request(app)
      .put('/api/settings/llm')
      .set('Authorization', `Bearer ${token}`)
      .send({ provider: 'anthropic', api_key: 'sk-ant-very-secret-12345' });
    const userRes = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    const stored = await getLlmConfig(userRes.body.user.id);
    expect(stored.api_key_enc).toBeTruthy();
    expect(stored.api_key_enc).not.toBe('sk-ant-very-secret-12345');
    expect(stored.api_key_enc.startsWith('v1:')).toBe(true);
    expect(decrypt(stored.api_key_enc)).toBe('sk-ant-very-secret-12345');
  });

  it('rejects unknown providers', async () => {
    const res = await request(app)
      .put('/api/settings/llm')
      .set('Authorization', `Bearer ${token}`)
      .send({ provider: 'nonsense', api_key: 'x' });
    expect(res.status).toBe(400);
  });

  it('returns active_source=byok after save', async () => {
    await request(app)
      .put('/api/settings/llm')
      .set('Authorization', `Bearer ${token}`)
      .send({ provider: 'openai', api_key: 'sk-test', base_url: 'https://api.openai.com/v1', model_id: 'gpt-4o-mini' });
    const res = await request(app).get('/api/settings/llm').set('Authorization', `Bearer ${token}`);
    expect(res.body.active_source).toBe('byok');
    expect(res.body.active_provider).toBe('openai');
  });

  it('DELETE removes the user config', async () => {
    await request(app)
      .put('/api/settings/llm')
      .set('Authorization', `Bearer ${token}`)
      .send({ provider: 'anthropic', api_key: 'sk-test' });
    let res = await request(app).get('/api/settings/llm').set('Authorization', `Bearer ${token}`);
    expect(res.body.config).not.toBeNull();
    res = await request(app).delete('/api/settings/llm').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    res = await request(app).get('/api/settings/llm').set('Authorization', `Bearer ${token}`);
    expect(res.body.config).toBeNull();
  });

  it('POST /test uses the local provider without external calls', async () => {
    // Configure a local provider for this user to avoid hitting Anthropic
    await request(app)
      .put('/api/settings/llm')
      .set('Authorization', `Bearer ${token}`)
      .send({ provider: 'local' });
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const res = await request(app)
      .post('/api/settings/llm/test')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.provider).toBe('local');
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('BYOK is honored by AI endpoints', () => {
  it('generate-request routes through user config when set', async () => {
    // User picks local provider — endpoint should still respond with valid JSON
    await request(app)
      .put('/api/settings/llm')
      .set('Authorization', `Bearer ${token}`)
      .send({ provider: 'local' });
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const res = await request(app)
      .post('/api/ai/generate-request')
      .set('Authorization', `Bearer ${token}`)
      .send({ prompt: 'GET https://api.example.com/widgets' });
    expect(res.status).toBe(200);
    expect(res.body.method).toBe('GET');
    expect(fetchSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('api.anthropic.com'),
      expect.anything()
    );
  });

  it('falls back to server default when user has no config', async () => {
    // No BYOK config set. Server default is anthropic with mock key; intercept fetch.
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        model: 'claude-sonnet-4-6',
        content: [{ type: 'text', text: '{"method":"GET","url":"https://api.example.com","headers":[],"params":[],"body":{"type":"none","content":""},"name":"x"}' }],
      }),
    });
    vi.spyOn(globalThis, 'fetch').mockImplementation(fakeFetch);
    const res = await request(app)
      .post('/api/ai/generate-request')
      .set('Authorization', `Bearer ${token}`)
      .send({ prompt: 'GET widgets' });
    expect(res.status).toBe(200);
    // Server default path hits Anthropic
    expect(fakeFetch).toHaveBeenCalledWith(
      'https://api.anthropic.com/v1/messages',
      expect.anything()
    );
  });
});
