/**
 * Tiny Anthropic client used by the AI Ops Agent. Mirrors the call shape
 * used by tests so they can mock via { anthropicCall, fetchImpl }.
 */
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';

export async function callAnthropic({
  prompt, system, maxTokens = 1024, model = DEFAULT_MODEL, fetchImpl = fetch,
}) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    const err = new Error('ANTHROPIC_API_KEY is not configured');
    err.status = 503;
    throw err;
  }
  const body = {
    model,
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: prompt }],
  };
  if (system) body.system = system;

  const res = await fetchImpl(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data?.error?.message || `Anthropic error ${res.status}`);
    err.status = res.status;
    throw err;
  }
  const text = Array.isArray(data.content)
    ? data.content.filter(c => c.type === 'text').map(c => c.text).join('\n')
    : '';
  return { text, raw: data, model: data.model || model };
}
