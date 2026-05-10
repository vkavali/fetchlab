/**
 * AI Ops Agent LLM call. Routes through the multi-provider LLM abstraction
 * (server/llm), so an enterprise can run the agent on Bedrock/Vertex/OpenAI
 * by setting LLM_PROVIDER. Mirrors the original `callAnthropic` shape so
 * the existing agent.js / detector.js code and tests still work.
 *
 * Tests can override behavior by passing either:
 *   - anthropicCall: a custom function with the same shape, OR
 *   - fetchImpl: a fake fetch (used when the default Anthropic provider runs)
 */
import { defaultProvider } from '../llm/index.js';
import { AnthropicProvider } from '../llm/anthropic.js';

const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';

export async function callAnthropic({
  prompt, system, maxTokens = 1024, model = DEFAULT_MODEL, fetchImpl,
}) {
  // When a fetchImpl is supplied (used by tests/mocks), route through a fresh
  // AnthropicProvider with that fetchImpl so test assertions on the URL/headers
  // continue to work. Otherwise use the configured default provider — which
  // could be Bedrock, Vertex, OpenAI-compat, etc.
  const provider = fetchImpl
    ? new AnthropicProvider({ fetchImpl })
    : defaultProvider();

  const messages = [{ role: 'user', content: prompt }];
  const result = await provider.chat(messages, { system, maxTokens, model });
  return {
    text: result.content,
    raw: result,
    model: result.usage?.model || model,
  };
}
