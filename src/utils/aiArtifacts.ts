import type { RequestConfig, ResponseData } from '../types';

export type AgentFramework = 'langchain' | 'llamaindex' | 'crewai';

const TOKEN_CHARS = 4;
const DEFAULT_INPUT_COST_PER_MILLION = 3;

function enabledPairs(items: RequestConfig['headers']) {
  return items.filter(item => item.enabled && item.key.trim());
}

function redactValue(key: string, value: string) {
  if (/authorization|token|secret|password|api[-_ ]?key|cookie/i.test(key)) {
    return '[redacted]';
  }
  return value;
}

function safeParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function normalizeBody(response: ResponseData) {
  const parsed = safeParseJson(response.body);
  if (parsed !== null) return JSON.stringify(parsed, null, 2);
  if (response.contentType.includes('html')) {
    return response.body
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  return response.body.trim();
}

export function estimateTokens(text: string) {
  return Math.max(1, Math.ceil(text.length / TOKEN_CHARS));
}

export function estimateInputCost(text: string, costPerMillion = DEFAULT_INPUT_COST_PER_MILLION) {
  return (estimateTokens(text) / 1_000_000) * costPerMillion;
}

export function buildAiReadyJson(request: RequestConfig, response: ResponseData) {
  const requestHeaders = enabledPairs(request.headers).map(header => ({
    key: header.key,
    value: redactValue(header.key, header.value),
  }));
  const requestParams = enabledPairs(request.params).map(param => ({
    key: param.key,
    value: param.value,
  }));
  const responseHeaders = Object.fromEntries(
    Object.entries(response.headers).map(([key, value]) => [key, redactValue(key, value)])
  );

  return {
    fetchlab_artifact_version: '1.0',
    purpose: 'llm_api_debug_context',
    request: {
      name: request.name,
      method: request.method,
      url: request.url,
      params: requestParams,
      headers: requestHeaders,
      body_type: request.body.type,
      body: request.body.content || null,
      auth_type: request.auth.type,
    },
    response: {
      status: response.status,
      status_text: response.statusText,
      time_ms: Math.round(response.time),
      size_bytes: response.size,
      content_type: response.contentType,
      headers: responseHeaders,
      body: normalizeBody(response),
    },
    guidance: {
      use_for: [
        'debugging failed API calls',
        'generating assertions from the real response',
        'summarizing API behavior for agents',
        'building reproduction steps',
      ],
      human_review_required: true,
      secrets_redacted: true,
    },
  };
}

export function buildAiReadyMarkdown(request: RequestConfig, response: ResponseData) {
  const artifact = buildAiReadyJson(request, response);
  const responseBody = normalizeBody(response);
  const requestHeaders = artifact.request.headers.length
    ? artifact.request.headers.map(header => `- ${header.key}: ${header.value}`).join('\n')
    : '- none';
  const requestParams = artifact.request.params.length
    ? artifact.request.params.map(param => `- ${param.key}: ${param.value}`).join('\n')
    : '- none';

  return [
    '# FetchLab API Debug Artifact',
    '',
    '## Request',
    `- Name: ${request.name || 'Untitled request'}`,
    `- Method: ${request.method}`,
    `- URL: ${request.url || '(empty)'}`,
    `- Auth type: ${request.auth.type}`,
    '',
    '### Query Parameters',
    requestParams,
    '',
    '### Headers',
    requestHeaders,
    '',
    '### Body',
    request.body.content ? `\`\`\`${request.body.type}\n${request.body.content}\n\`\`\`` : 'No request body.',
    '',
    '## Response',
    `- Status: ${response.status} ${response.statusText}`,
    `- Time: ${Math.round(response.time)} ms`,
    `- Size: ${response.size} bytes`,
    `- Content-Type: ${response.contentType || 'unknown'}`,
    '',
    '### Response Body',
    `\`\`\`\n${responseBody || '(empty)'}\n\`\`\``,
    '',
    '## Agent Instructions',
    '- Treat this artifact as debugging context, not as ground truth documentation.',
    '- Generate test assertions only from the observed response above.',
    '- Do not assume secrets are present; obvious secret headers are redacted.',
    '- Human approval is required before changing production systems.',
  ].join('\n');
}

export function summarizeAiArtifact(text: string) {
  const tokens = estimateTokens(text);
  const cost = estimateInputCost(text);
  return {
    characters: text.length,
    tokens,
    costUsd: cost,
    label: `${tokens.toLocaleString()} est. tokens / $${cost.toFixed(5)} at $3 per 1M input tokens`,
  };
}

export function generateAgentFrameworkSnippet(request: RequestConfig, framework: AgentFramework) {
  const method = request.method.toUpperCase();
  const url = request.url || 'https://api.example.com/resource';
  const headers = Object.fromEntries(
    enabledPairs(request.headers).map(header => [header.key, redactValue(header.key, header.value)])
  );
  const body = request.body.content || '{}';

  switch (framework) {
    case 'langchain':
      return `from langchain_core.tools import tool
import requests

@tool
def fetchlab_${method.toLowerCase()}() -> dict:
    """Run the FetchLab-tested ${method} request and return status/body."""
    response = requests.request(
        "${method}",
        "${url}",
        headers=${JSON.stringify(headers, null, 8)},
        json=${request.body.type === 'json' && request.body.content ? body : 'None'},
        timeout=30,
    )
    return {"status": response.status_code, "body": response.text}
`;
    case 'llamaindex':
      return `from llama_index.core.tools import FunctionTool
import requests

def fetchlab_${method.toLowerCase()}() -> str:
    response = requests.request(
        "${method}",
        "${url}",
        headers=${JSON.stringify(headers, null, 8)},
        json=${request.body.type === 'json' && request.body.content ? body : 'None'},
        timeout=30,
    )
    return response.text

fetchlab_tool = FunctionTool.from_defaults(fn=fetchlab_${method.toLowerCase()})
`;
    case 'crewai':
      return `from crewai_tools import BaseTool
import requests

class FetchLab${method}Tool(BaseTool):
    name: str = "FetchLab ${method} request"
    description: str = "Runs a FetchLab-tested API request and returns the response text."

    def _run(self) -> str:
        response = requests.request(
            "${method}",
            "${url}",
            headers=${JSON.stringify(headers, null, 12)},
            json=${request.body.type === 'json' && request.body.content ? body : 'None'},
            timeout=30,
        )
        return response.text
`;
  }
}
