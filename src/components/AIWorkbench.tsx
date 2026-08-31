import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Bot,
  CheckCircle2,
  ClipboardCheck,
  Code2,
  Copy,
  Cpu,
  Download,
  FileJson,
  FlaskConical,
  Gauge,
  KeyRound,
  Layers3,
  Loader2,
  Play,
  Plus,
  RefreshCw,
  Shield,
  Sparkles,
  TerminalSquare,
  Trash2,
  Wand2,
  X,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '../auth/useAuth';
import { useApp } from '../store/useApp';
import { aiPost } from '../utils/aiClient';
import {
  buildAiReadyMarkdown,
  generateAgentFrameworkSnippet,
  summarizeAiArtifact,
  type AgentFramework,
} from '../utils/aiArtifacts';
import { generateCodeSnippet, generateId } from '../utils/helpers';
import type { RequestConfig, ResponseData } from '../types';

interface Props {
  onClose: () => void;
  onOpenAgent: () => void;
  onOpenLlmSettings: () => void;
  onOpenSecurity: () => void;
  onOpenRequestBuilder: () => void;
}

interface LlmInfo {
  config?: {
    provider?: string;
    has_api_key?: boolean;
    model_id?: string;
    base_url?: string;
  } | null;
  active_provider?: string;
  active_source?: string;
  server_default?: { provider?: string; configured?: boolean; model?: string };
  providers?: string[];
}

interface AgentStatus {
  aiEnabled?: boolean;
  slackEnabled?: boolean;
  githubEnabled?: boolean;
}

interface PromptRunResponse {
  content: string;
  provider: string;
  source: string;
  model?: string;
  usage?: { input_tokens?: number; output_tokens?: number; model?: string; provider?: string } | null;
}

interface PromptRunRecord extends PromptRunResponse {
  id: string;
  label: string;
  prompt: string;
  latencyMs: number;
  createdAt: number;
}

type WorkbenchTab = 'overview' | 'prompt' | 'evals' | 'tools' | 'ops';
type EvalScorer = 'contains' | 'json' | 'nonempty';
type ToolFormat = 'openai' | 'mcp' | 'langchain' | 'llamaindex' | 'crewai' | 'context' | 'curl';

interface EvalCase {
  id: string;
  name: string;
  input: string;
  expected: string;
  scorer: EvalScorer;
}

interface EvalRunResult {
  id: string;
  caseId: string;
  caseName: string;
  passed: boolean;
  reason: string;
  output: string;
  provider: string;
  model?: string;
  latencyMs: number;
  createdAt: number;
}

const EVAL_CASES_KEY = 'fetchlab_ai_eval_cases_v1';

const providerLabel: Record<string, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI compatible',
  bedrock: 'AWS Bedrock',
  vertex: 'Google Vertex AI',
  local: 'Local baseline',
};

const defaultSystemPrompt = 'You are FetchLab AI Workbench. Help an engineering team turn API behavior into reliable AI product behavior. Be specific, practical, and concise.';

function loadEvalCases(): EvalCase[] {
  try {
    const raw = localStorage.getItem(EVAL_CASES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(item => item?.id && item?.name && item?.input) as EvalCase[];
  } catch {
    return [];
  }
}

function saveEvalCases(cases: EvalCase[]) {
  try { localStorage.setItem(EVAL_CASES_KEY, JSON.stringify(cases)); } catch { /* ignore */ }
}

function compactBody(body: string, max = 2200) {
  if (!body) return '';
  return body.length > max ? `${body.slice(0, max)}\n... [truncated ${body.length - max} chars]` : body;
}

function enabledPairs(items: RequestConfig['headers']) {
  return (items || []).filter(item => item.enabled && item.key.trim());
}

function redactValue(key: string, value: string) {
  if (/authorization|token|secret|password|api[-_ ]?key|cookie/i.test(key)) return '[redacted]';
  return value;
}

function methodTone(method?: string) {
  switch ((method || '').toUpperCase()) {
    case 'GET': return 'text-green-300 bg-green-500/10 border-green-500/20';
    case 'POST': return 'text-blue-300 bg-blue-500/10 border-blue-500/20';
    case 'PUT':
    case 'PATCH': return 'text-amber-300 bg-amber-500/10 border-amber-500/20';
    case 'DELETE': return 'text-red-300 bg-red-500/10 border-red-500/20';
    default: return 'text-gray-300 bg-gray-500/10 border-gray-500/20';
  }
}

function statusTone(status?: number) {
  if (!status) return 'text-gray-400 bg-gray-500/10 border-gray-500/20';
  if (status >= 200 && status < 300) return 'text-green-300 bg-green-500/10 border-green-500/20';
  if (status >= 300 && status < 400) return 'text-cyan-300 bg-cyan-500/10 border-cyan-500/20';
  if (status >= 400 && status < 500) return 'text-amber-300 bg-amber-500/10 border-amber-500/20';
  return 'text-red-300 bg-red-500/10 border-red-500/20';
}

function safeJsonParse(text: string): unknown | null {
  try { return JSON.parse(text); } catch { return null; }
}

function topLevelKeys(response?: ResponseData | null) {
  if (!response) return [] as string[];
  const parsed = safeJsonParse(response.body);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return [] as string[];
  return Object.keys(parsed as Record<string, unknown>).slice(0, 8);
}

function buildWorkbenchContext(request?: RequestConfig | null, response?: ResponseData | null) {
  return {
    request: request ? {
      name: request.name,
      method: request.method,
      url: request.url,
      params: enabledPairs(request.params).map(p => ({ key: p.key, value: p.value })),
      headers: enabledPairs(request.headers).map(h => ({ key: h.key, value: redactValue(h.key, h.value) })),
      body_type: request.body.type,
      body: compactBody(request.body.content, 1200),
      auth_type: request.auth.type,
      has_test_script: !!request.testScript?.trim(),
    } : null,
    response: response ? {
      status: response.status,
      status_text: response.statusText,
      time_ms: Math.round(response.time),
      size_bytes: response.size,
      content_type: response.contentType,
      headers: Object.fromEntries(Object.entries(response.headers || {}).map(([k, v]) => [k, redactValue(k, v)])),
      body: compactBody(response.body, 2200),
      top_level_keys: topLevelKeys(response),
    } : null,
  };
}

function scoreOutput(output: string, evalCase: EvalCase) {
  const expected = evalCase.expected.trim();
  if (evalCase.scorer === 'nonempty') {
    const passed = output.trim().length >= 24;
    return { passed, reason: passed ? 'Returned a usable response.' : 'Output was too short to be useful.' };
  }
  if (evalCase.scorer === 'json') {
    const direct = safeJsonParse(output);
    const start = output.indexOf('{');
    const end = output.lastIndexOf('}');
    const extracted = start >= 0 && end > start ? safeJsonParse(output.slice(start, end + 1)) : null;
    const passed = !!(direct || extracted);
    return { passed, reason: passed ? 'Output contained valid JSON.' : 'Output did not contain parseable JSON.' };
  }
  const passed = !expected || output.toLowerCase().includes(expected.toLowerCase());
  return { passed, reason: passed ? `Output included "${expected}".` : `Missing expected text "${expected}".` };
}

function toolFunctionName(request?: RequestConfig | null) {
  const source = `${request?.method || 'run'}_${request?.name || request?.url || 'fetchlab_request'}`;
  const name = source.toLowerCase().replace(/https?:\/\//g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 56);
  return name || 'fetchlab_request';
}

function buildOpenAiTool(request?: RequestConfig | null) {
  const name = toolFunctionName(request);
  const method = request?.method || 'GET';
  const url = request?.url || 'https://api.example.com/resource';
  return JSON.stringify({
    type: 'function',
    function: {
      name,
      description: `Run the FetchLab-tested ${method} request against ${url}`,
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'object',
            description: 'Optional query parameter overrides.',
            additionalProperties: { type: 'string' },
          },
          body: {
            type: 'object',
            description: 'Optional JSON body override when the endpoint accepts a body.',
          },
        },
        additionalProperties: false,
      },
    },
  }, null, 2);
}

function defaultBodyLiteral(request?: RequestConfig | null) {
  const content = request?.body.content?.trim();
  if (!content) return '{}';
  if (request?.body.type === 'json') {
    const parsed = safeJsonParse(content);
    if (parsed !== null) return JSON.stringify(parsed, null, 6);
  }
  return JSON.stringify(content);
}

function buildMcpTool(request?: RequestConfig | null) {
  const name = toolFunctionName(request);
  const method = request?.method || 'GET';
  const url = request?.url || 'https://api.example.com/resource';
  const headers = Object.fromEntries(enabledPairs(request?.headers || []).map(h => [h.key, redactValue(h.key, h.value)]));
  const title = request?.name || `${method} ${url}`;
  return `import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const server = new McpServer({ name: "fetchlab-tools", version: "0.1.0" });

server.registerTool(
  "${name}",
  {
    title: ${JSON.stringify(title)},
    description: "Run a FetchLab-tested API request and return status, headers, and body.",
    inputSchema: {
      query: z.record(z.string()).optional(),
      body: z.unknown().optional(),
    },
  },
  async ({ query = {}, body }) => {
    const target = new URL(${JSON.stringify(url)});
    Object.entries(query).forEach(([key, value]) => target.searchParams.set(key, value));
    const response = await fetch(target, {
      method: "${method}",
      headers: ${JSON.stringify(headers, null, 6)},
      body: ["GET", "HEAD"].includes("${method}") ? undefined : JSON.stringify(body ?? ${defaultBodyLiteral(request)}),
    });
    return {
      content: [{ type: "text", text: await response.text() }],
      metadata: { status: response.status, contentType: response.headers.get("content-type") },
    };
  }
);
`;
}

function toolExtension(format: ToolFormat) {
  if (format === 'openai') return 'json';
  if (format === 'context') return 'md';
  if (format === 'curl') return 'sh';
  if (format === 'mcp') return 'ts';
  return 'py';
}

function buildToolOutput(format: ToolFormat, request?: RequestConfig | null, response?: ResponseData | null) {
  if (!request && format !== 'context') return 'Select or create a request in the API Workbench first.';
  if (format === 'openai') return buildOpenAiTool(request);
  if (format === 'mcp') return buildMcpTool(request);
  if (format === 'context') {
    if (!request || !response) return 'Run a request first to generate an AI-ready context bundle.';
    return buildAiReadyMarkdown(request, response);
  }
  if (format === 'curl') return request ? generateCodeSnippet(request, 'curl') : '';
  return request ? generateAgentFrameworkSnippet(request, format as AgentFramework) : '';
}

function buildSeedEvalCases(request?: RequestConfig | null, response?: ResponseData | null): EvalCase[] {
  const method = request?.method || 'GET';
  const url = request?.url || 'the active endpoint';
  const status = response?.status ?? 200;
  const keys = topLevelKeys(response);
  return [
    {
      id: generateId(),
      name: 'Explains the observed API contract',
      input: `Using the current FetchLab context, summarize the consumer contract for ${method} ${url}. Include status, required inputs, and the main response fields.`,
      expected: String(status),
      scorer: 'contains',
    },
    {
      id: generateId(),
      name: 'Produces a regression test plan',
      input: `Create a concise regression test plan for ${method} ${url}. Include status checks, latency checks, auth risks, and schema checks.`,
      expected: 'test',
      scorer: 'contains',
    },
    {
      id: generateId(),
      name: 'Returns machine-readable release gate',
      input: `Return JSON only: {"ship": boolean, "risks": string[], "required_evals": string[]} for the current API-backed AI workflow.${keys.length ? ` The response contains these fields: ${keys.join(', ')}.` : ''}`,
      expected: '',
      scorer: 'json',
    },
  ];
}

function downloadText(text: string, filename: string, type = 'text/plain') {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function AIWorkbench({ onClose, onOpenAgent, onOpenLlmSettings, onOpenSecurity, onOpenRequestBuilder }: Props) {
  const { authFetch, activeWorkspaceId, user } = useAuth();
  const { state } = useApp();
  const [activePane, setActivePane] = useState<WorkbenchTab>('overview');
  const [llm, setLlm] = useState<LlmInfo | null>(null);
  const [agent, setAgent] = useState<AgentStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  const [systemPrompt, setSystemPrompt] = useState(defaultSystemPrompt);
  const [prompt, setPrompt] = useState('Using the current FetchLab API context, identify what should be evaluated before this becomes an AI product workflow. Return a tight action plan.');
  const [includeContext, setIncludeContext] = useState(true);
  const [compareLocal, setCompareLocal] = useState(true);
  const [promptRunning, setPromptRunning] = useState(false);
  const [promptError, setPromptError] = useState<string | null>(null);
  const [promptRuns, setPromptRuns] = useState<PromptRunRecord[]>([]);

  const [evalCases, setEvalCases] = useState<EvalCase[]>(() => loadEvalCases());
  const [evalRunning, setEvalRunning] = useState(false);
  const [evalProvider, setEvalProvider] = useState<'active' | 'local'>('active');
  const [evalResults, setEvalResults] = useState<EvalRunResult[]>([]);
  const [newEval, setNewEval] = useState<EvalCase>(() => ({
    id: generateId(),
    name: 'Answers with concrete API risk',
    input: 'Given the current API response, name one production risk and the exact eval that should catch it.',
    expected: 'risk',
    scorer: 'contains',
  }));

  const [toolFormat, setToolFormat] = useState<ToolFormat>('openai');
  const [copied, setCopied] = useState(false);

  const activeTab = state.tabs.find(tab => tab.id === state.activeTabId);
  const request = activeTab ? state.requests[activeTab.requestId] : null;
  const response = activeTab ? state.responses[activeTab.requestId] : null;
  const context = useMemo(() => buildWorkbenchContext(request, response), [request, response]);
  const toolOutput = useMemo(() => buildToolOutput(toolFormat, request, response), [toolFormat, request, response]);
  const activeProvider = llm?.active_provider || llm?.config?.provider || llm?.server_default?.provider || 'local';
  const providerConfigured = activeProvider === 'local' || !!llm?.config || !!llm?.server_default?.configured;
  const aiArtifact = request && response ? buildAiReadyMarkdown(request, response) : '';
  const artifactSummary = aiArtifact ? summarizeAiArtifact(aiArtifact) : null;
  const passRate = evalResults.length ? Math.round((evalResults.filter(r => r.passed).length / evalResults.length) * 100) : 0;

  const readiness = useMemo(() => [
    { label: 'Model route', ok: providerConfigured, detail: providerLabel[activeProvider] || activeProvider },
    { label: 'API context', ok: !!request, detail: request ? `${request.method} ${request.url || 'untitled'}` : 'No active request' },
    { label: 'Observed response', ok: !!response, detail: response ? `${response.status} in ${Math.round(response.time)} ms` : 'Run a request' },
    { label: 'Eval cases', ok: evalCases.length > 0, detail: `${evalCases.length} saved` },
    { label: 'Agent loop', ok: !!agent?.githubEnabled || !!agent?.slackEnabled, detail: agent?.githubEnabled ? 'GitHub connected' : agent?.slackEnabled ? 'Slack connected' : 'Manual mode' },
  ], [activeProvider, agent?.githubEnabled, agent?.slackEnabled, evalCases.length, providerConfigured, request, response]);
  const readinessScore = Math.round((readiness.filter(item => item.ok).length / readiness.length) * 100);

  useEffect(() => { saveEvalCases(evalCases); }, [evalCases]);

  useEffect(() => {
    let alive = true;
    async function load() {
      setLoadingStatus(true);
      setStatusError(null);
      try {
        const [llmRes, agentRes] = await Promise.allSettled([
          authFetch('/api/settings/llm'),
          authFetch('/api/agent/status'),
        ]);
        if (!alive) return;
        if (llmRes.status === 'fulfilled' && llmRes.value.ok) setLlm(await llmRes.value.json());
        if (agentRes.status === 'fulfilled' && agentRes.value.ok) setAgent(await agentRes.value.json());
      } catch (err) {
        if (alive) setStatusError(err instanceof Error ? err.message : 'Could not load AI status');
      } finally {
        if (alive) setLoadingStatus(false);
      }
    }
    load();
    return () => { alive = false; };
  }, [authFetch, activeWorkspaceId]);

  const refreshStatus = async () => {
    setLoadingStatus(true);
    setStatusError(null);
    try {
      const [llmRes, agentRes] = await Promise.all([
        authFetch('/api/settings/llm'),
        authFetch('/api/agent/status'),
      ]);
      if (llmRes.ok) setLlm(await llmRes.json());
      if (agentRes.ok) setAgent(await agentRes.json());
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : 'Could not load AI status');
    } finally {
      setLoadingStatus(false);
    }
  };

  const runPrompt = async () => {
    if (!user) {
      setPromptError('Sign in to run model-backed AI workbench actions.');
      return;
    }
    if (!prompt.trim()) return;
    setPromptRunning(true);
    setPromptError(null);
    const jobs: Array<{ label: string; provider?: 'local' }> = [{ label: 'Active route' }];
    if (compareLocal) jobs.push({ label: 'Local baseline', provider: 'local' });
    const nextRuns: PromptRunRecord[] = [];
    try {
      for (const job of jobs) {
        const started = performance.now();
        const result = await aiPost<PromptRunResponse>('/api/ai/run-prompt', {
          system: systemPrompt,
          prompt,
          context: includeContext ? context : undefined,
          provider: job.provider,
          maxTokens: 1400,
          temperature: 0.2,
        });
        nextRuns.push({
          ...result,
          id: generateId(),
          label: job.label,
          prompt,
          latencyMs: Math.round(performance.now() - started),
          createdAt: Date.now(),
        });
      }
      setPromptRuns(prev => [...nextRuns, ...prev].slice(0, 8));
    } catch (err) {
      setPromptError(err instanceof Error ? err.message : 'Prompt run failed');
    } finally {
      setPromptRunning(false);
    }
  };

  const seedEvalCases = () => {
    const seeded = buildSeedEvalCases(request, response);
    setEvalCases(prev => [...seeded, ...prev].slice(0, 24));
    setActivePane('evals');
  };

  const addEvalCase = () => {
    if (!newEval.name.trim() || !newEval.input.trim()) return;
    setEvalCases(prev => [{ ...newEval, id: generateId() }, ...prev].slice(0, 30));
    setNewEval({
      id: generateId(),
      name: 'Answers with concrete API risk',
      input: 'Given the current API response, name one production risk and the exact eval that should catch it.',
      expected: 'risk',
      scorer: 'contains',
    });
  };

  const runEvals = async () => {
    if (!user) return;
    if (!evalCases.length) seedEvalCases();
    const cases = evalCases.length ? evalCases.slice(0, 8) : buildSeedEvalCases(request, response);
    setEvalRunning(true);
    const nextResults: EvalRunResult[] = [];
    try {
      for (const item of cases) {
        const started = performance.now();
        const result = await aiPost<PromptRunResponse>('/api/ai/run-prompt', {
          system: `${defaultSystemPrompt}\nReturn an answer that can be judged by an automated scorer.`,
          prompt: item.input,
          context: includeContext ? context : undefined,
          provider: evalProvider === 'local' ? 'local' : undefined,
          maxTokens: 900,
          temperature: 0,
        });
        const scored = scoreOutput(result.content, item);
        nextResults.push({
          id: generateId(),
          caseId: item.id,
          caseName: item.name,
          passed: scored.passed,
          reason: scored.reason,
          output: result.content,
          provider: result.provider,
          model: result.model,
          latencyMs: Math.round(performance.now() - started),
          createdAt: Date.now(),
        });
      }
      setEvalResults(prev => [...nextResults, ...prev].slice(0, 40));
    } finally {
      setEvalRunning(false);
    }
  };

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="fixed inset-0 z-50 bg-gray-950 text-gray-100" onClick={onClose}>
      <div className="flex h-full flex-col" onClick={e => e.stopPropagation()}>
        <header className="flex h-14 items-center justify-between border-b border-gray-800 bg-gray-950 px-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-md border border-cyan-500/20 bg-cyan-500/10 text-cyan-300">
              <Sparkles size={17} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-gray-100">AI Workbench</h2>
                <span className="rounded border border-gray-700 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-gray-500">Beta</span>
              </div>
              <div className="truncate text-[11px] text-gray-500">Prompts, evals, tools, and agent handoff from live API context</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <StatusPill ok={providerConfigured} label={providerLabel[activeProvider] || activeProvider} />
            <button onClick={refreshStatus} className="rounded-md p-1.5 text-gray-500 hover:bg-gray-800 hover:text-gray-200" title="Refresh AI status">
              <RefreshCw size={15} className={loadingStatus ? 'animate-spin' : ''} />
            </button>
            <button onClick={onClose} className="rounded-md p-1.5 text-gray-500 hover:bg-gray-800 hover:text-gray-200" title="Close">
              <X size={17} />
            </button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1">
          <aside className="w-[232px] shrink-0 border-r border-gray-800 bg-gray-950 px-3 py-4">
            <nav className="space-y-1">
              <NavButton active={activePane === 'overview'} icon={Gauge} label="Overview" onClick={() => setActivePane('overview')} />
              <NavButton active={activePane === 'prompt'} icon={Wand2} label="Prompt Lab" onClick={() => setActivePane('prompt')} />
              <NavButton active={activePane === 'evals'} icon={FlaskConical} label="Eval Lab" onClick={() => setActivePane('evals')} />
              <NavButton active={activePane === 'tools'} icon={Code2} label="Tool Builder" onClick={() => setActivePane('tools')} />
              <NavButton active={activePane === 'ops'} icon={Shield} label="Ops" onClick={() => setActivePane('ops')} />
            </nav>

            <div className="mt-5 rounded-md border border-gray-800 bg-gray-900/40 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Ship score</span>
                <span className="font-mono text-xs text-gray-200">{readinessScore}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded bg-gray-800">
                <div className="h-full bg-cyan-400" style={{ width: `${readinessScore}%` }} />
              </div>
              <div className="mt-3 space-y-2">
                {readiness.map(item => (
                  <div key={item.label} className="flex items-start gap-2">
                    {item.ok ? <CheckCircle2 size={13} className="mt-0.5 text-green-400" /> : <XCircle size={13} className="mt-0.5 text-gray-600" />}
                    <div className="min-w-0">
                      <div className="text-[11px] text-gray-300">{item.label}</div>
                      <div className="truncate text-[10px] text-gray-600">{item.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-3 rounded-md border border-gray-800 bg-gray-900/30 p-3">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Current API context</div>
              {request ? (
                <div className="mt-2 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className={`rounded border px-1.5 py-0.5 font-mono text-[10px] ${methodTone(request.method)}`}>{request.method}</span>
                    <span className="min-w-0 truncate text-xs text-gray-200">{request.name || 'Untitled'}</span>
                  </div>
                  <div className="break-all font-mono text-[10px] leading-4 text-gray-500">{request.url || 'No URL set'}</div>
                  {response ? (
                    <span className={`inline-flex rounded border px-1.5 py-0.5 font-mono text-[10px] ${statusTone(response.status)}`}>{response.status} {Math.round(response.time)} ms</span>
                  ) : (
                    <span className="text-[10px] text-amber-300">No response captured</span>
                  )}
                </div>
              ) : (
                <div className="mt-2 text-xs leading-5 text-gray-500">No request selected.</div>
              )}
            </div>
          </aside>

          <main className="min-w-0 flex-1 overflow-y-auto bg-gray-950">
            {statusError && (
              <div className="mx-5 mt-5 flex items-start gap-2 rounded-md border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                <span>{statusError}</span>
              </div>
            )}
            {activePane === 'overview' && (
              <OverviewPane
                activeProvider={activeProvider}
                providerConfigured={providerConfigured}
                agent={agent}
                request={request}
                response={response}
                collectionCount={state.collections.length}
                historyCount={state.history.length}
                evalCount={evalCases.length}
                passRate={passRate}
                artifactSummary={artifactSummary?.label || ''}
                onOpenPrompt={() => setActivePane('prompt')}
                onOpenEvals={() => setActivePane('evals')}
                onOpenTools={() => setActivePane('tools')}
                onOpenOps={() => setActivePane('ops')}
                onSeedEvals={seedEvalCases}
                onOpenRequestBuilder={onOpenRequestBuilder}
              />
            )}
            {activePane === 'prompt' && (
              <PromptPane
                systemPrompt={systemPrompt}
                setSystemPrompt={setSystemPrompt}
                prompt={prompt}
                setPrompt={setPrompt}
                includeContext={includeContext}
                setIncludeContext={setIncludeContext}
                compareLocal={compareLocal}
                setCompareLocal={setCompareLocal}
                running={promptRunning}
                error={promptError}
                runs={promptRuns}
                onRun={runPrompt}
                hasUser={!!user}
                hasContext={!!request}
              />
            )}
            {activePane === 'evals' && (
              <EvalPane
                cases={evalCases}
                setCases={setEvalCases}
                newEval={newEval}
                setNewEval={setNewEval}
                results={evalResults}
                running={evalRunning}
                provider={evalProvider}
                setProvider={setEvalProvider}
                onAdd={addEvalCase}
                onSeed={seedEvalCases}
                onRun={runEvals}
                hasUser={!!user}
                passRate={passRate}
              />
            )}
            {activePane === 'tools' && (
              <ToolsPane
                request={request}
                response={response}
                format={toolFormat}
                setFormat={setToolFormat}
                output={toolOutput}
                copied={copied}
                onCopy={() => copy(toolOutput)}
                onDownload={() => downloadText(toolOutput, `fetchlab-${toolFormat}-${toolFunctionName(request)}.${toolExtension(toolFormat)}`)}
              />
            )}
            {activePane === 'ops' && (
              <OpsPane
                llm={llm}
                agent={agent}
                providerConfigured={providerConfigured}
                activeProvider={activeProvider}
                onOpenAgent={onOpenAgent}
                onOpenLlmSettings={onOpenLlmSettings}
                onOpenSecurity={onOpenSecurity}
              />
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

function OverviewPane({
  activeProvider,
  providerConfigured,
  agent,
  request,
  response,
  collectionCount,
  historyCount,
  evalCount,
  passRate,
  artifactSummary,
  onOpenPrompt,
  onOpenEvals,
  onOpenTools,
  onOpenOps,
  onSeedEvals,
  onOpenRequestBuilder,
}: {
  activeProvider: string;
  providerConfigured: boolean;
  agent: AgentStatus | null;
  request: RequestConfig | null;
  response: ResponseData | null;
  collectionCount: number;
  historyCount: number;
  evalCount: number;
  passRate: number;
  artifactSummary: string;
  onOpenPrompt: () => void;
  onOpenEvals: () => void;
  onOpenTools: () => void;
  onOpenOps: () => void;
  onSeedEvals: () => void;
  onOpenRequestBuilder: () => void;
}) {
  return (
    <div className="p-5">
      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            <Metric icon={Cpu} label="Model route" value={providerLabel[activeProvider] || activeProvider} tone={providerConfigured ? 'cyan' : 'amber'} />
            <Metric icon={Layers3} label="API assets" value={`${collectionCount} collections`} tone="blue" />
            <Metric icon={FlaskConical} label="Eval cases" value={`${evalCount} saved`} tone={evalCount ? 'green' : 'amber'} />
            <Metric icon={BarChart3} label="Last pass rate" value={passRate ? `${passRate}%` : 'No runs'} tone={passRate >= 80 ? 'green' : passRate ? 'amber' : 'gray'} />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <WorkCard icon={Wand2} title="Prompt Lab" label="Run active route vs local baseline" detail="Use the selected API request and response as prompt context, then compare provider output to a deterministic local baseline." cta="Open Prompt Lab" onClick={onOpenPrompt} />
            <WorkCard icon={FlaskConical} title="Eval Lab" label="Turn behavior into release gates" detail="Seed cases from the current endpoint, run them against the model route, and keep pass/fail evidence for review." cta={evalCount ? 'Open Eval Lab' : 'Seed evals'} onClick={evalCount ? onOpenEvals : onSeedEvals} />
            <WorkCard icon={Code2} title="Tool Builder" label="Export agent-ready tools" detail="Generate OpenAI function schemas, MCP tool skeletons, framework snippets, cURL, and AI-ready context bundles." cta="Build tools" onClick={onOpenTools} />
            <WorkCard icon={Shield} title="Ops" label="Provider, agent, and governance" detail="Check BYOK, local mode, Slack/GitHub agent status, and security controls from one place." cta="Open Ops" onClick={onOpenOps} />
          </div>
        </section>

        <aside className="space-y-4">
          <Panel title="Active Context" icon={ClipboardCheck}>
            {request ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className={`rounded border px-2 py-1 font-mono text-[11px] ${methodTone(request.method)}`}>{request.method}</span>
                  <span className="min-w-0 truncate text-sm font-semibold text-gray-100">{request.name || 'Untitled request'}</span>
                </div>
                <div className="break-all font-mono text-xs leading-5 text-gray-500">{request.url || 'No URL set'}</div>
                <div className="grid grid-cols-3 gap-2">
                  <MiniStat label="Headers" value={String(enabledPairs(request.headers).length)} />
                  <MiniStat label="Params" value={String(enabledPairs(request.params).length)} />
                  <MiniStat label="History" value={String(historyCount)} />
                </div>
                {response ? (
                  <div className="rounded-md border border-gray-800 bg-gray-950/70 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Observed response</span>
                      <span className={`rounded border px-1.5 py-0.5 font-mono text-[10px] ${statusTone(response.status)}`}>{response.status}</span>
                    </div>
                    <div className="font-mono text-[11px] text-gray-400">{Math.round(response.time)} ms / {response.size} bytes</div>
                    {artifactSummary && <div className="mt-2 text-[10px] text-gray-600">{artifactSummary}</div>}
                  </div>
                ) : (
                  <div className="rounded-md border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-200">Run the request once to unlock eval seeding and context export.</div>
                )}
              </div>
            ) : (
              <EmptyState icon={TerminalSquare} title="No request selected" body="Create or select an API request before building prompts, evals, or tools." action="Create with AI" onAction={onOpenRequestBuilder} />
            )}
          </Panel>

          <Panel title="Operating Loop" icon={Bot}>
            <div className="space-y-2">
              <LoopStep ok={!!request} label="Capture real API behavior" />
              <LoopStep ok={!!response} label="Attach observed response" />
              <LoopStep ok={evalCount > 0} label="Define eval cases" />
              <LoopStep ok={providerConfigured} label="Run through approved model route" />
              <LoopStep ok={!!agent?.githubEnabled || !!agent?.slackEnabled} label="Hand off to agent workflow" />
            </div>
          </Panel>
        </aside>
      </div>
    </div>
  );
}

function PromptPane({
  systemPrompt,
  setSystemPrompt,
  prompt,
  setPrompt,
  includeContext,
  setIncludeContext,
  compareLocal,
  setCompareLocal,
  running,
  error,
  runs,
  onRun,
  hasUser,
  hasContext,
}: {
  systemPrompt: string;
  setSystemPrompt: (value: string) => void;
  prompt: string;
  setPrompt: (value: string) => void;
  includeContext: boolean;
  setIncludeContext: (value: boolean) => void;
  compareLocal: boolean;
  setCompareLocal: (value: boolean) => void;
  running: boolean;
  error: string | null;
  runs: PromptRunRecord[];
  onRun: () => void;
  hasUser: boolean;
  hasContext: boolean;
}) {
  return (
    <div className="grid min-h-full gap-4 p-5 xl:grid-cols-[0.92fr_1.08fr]">
      <section className="space-y-4">
        <Panel title="Prompt Runner" icon={Wand2}>
          <div className="space-y-3">
            <FieldLabel label="System" />
            <textarea value={systemPrompt} onChange={e => setSystemPrompt(e.target.value)} rows={4} className="w-full resize-none rounded-md border border-gray-800 bg-gray-950 px-3 py-2 font-mono text-xs leading-5 text-gray-200 outline-none focus:border-cyan-500/50" />
            <FieldLabel label="User prompt" />
            <textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={8} className="w-full resize-none rounded-md border border-gray-800 bg-gray-950 px-3 py-2 text-sm leading-6 text-gray-100 outline-none focus:border-cyan-500/50" />
            <div className="flex flex-wrap items-center gap-2">
              <Toggle checked={includeContext} onChange={setIncludeContext} label="Use API context" disabled={!hasContext} />
              <Toggle checked={compareLocal} onChange={setCompareLocal} label="Compare local baseline" />
            </div>
            {error && <Notice tone="red" icon={AlertTriangle}>{error}</Notice>}
            {!hasUser && <Notice tone="amber" icon={AlertTriangle}>Sign in is required for server-side AI runs.</Notice>}
            <div className="flex items-center justify-between border-t border-gray-800 pt-3">
              <div className="text-[11px] text-gray-600">Active provider uses your configured BYOK route.</div>
              <button onClick={onRun} disabled={running || !prompt.trim() || !hasUser} className="flex h-9 items-center gap-2 rounded-md bg-cyan-500 px-4 text-xs font-semibold text-gray-950 hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50">
                {running ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                Run prompt
              </button>
            </div>
          </div>
        </Panel>
      </section>

      <section className="space-y-4">
        <Panel title="Run Output" icon={BarChart3}>
          {runs.length ? (
            <div className="space-y-3">
              {runs.map(run => (
                <div key={run.id} className="rounded-md border border-gray-800 bg-gray-950/70 p-3">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="rounded bg-gray-800 px-2 py-1 text-[10px] font-semibold text-gray-300">{run.label}</span>
                      <span className="truncate text-xs text-gray-500">{providerLabel[run.provider] || run.provider} {run.model ? `/ ${run.model}` : ''}</span>
                    </div>
                    <span className="font-mono text-[10px] text-gray-600">{run.latencyMs} ms</span>
                  </div>
                  <pre className="max-h-[300px] overflow-auto whitespace-pre-wrap rounded border border-gray-800 bg-black/20 p-3 text-xs leading-5 text-gray-300">{run.content}</pre>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={Play} title="No prompt runs yet" body="Run the prompt to compare model output against the local baseline and current API context." />
          )}
        </Panel>
      </section>
    </div>
  );
}

function EvalPane({
  cases,
  setCases,
  newEval,
  setNewEval,
  results,
  running,
  provider,
  setProvider,
  onAdd,
  onSeed,
  onRun,
  hasUser,
  passRate,
}: {
  cases: EvalCase[];
  setCases: (cases: EvalCase[]) => void;
  newEval: EvalCase;
  setNewEval: (value: EvalCase) => void;
  results: EvalRunResult[];
  running: boolean;
  provider: 'active' | 'local';
  setProvider: (value: 'active' | 'local') => void;
  onAdd: () => void;
  onSeed: () => void;
  onRun: () => void;
  hasUser: boolean;
  passRate: number;
}) {
  return (
    <div className="grid min-h-full gap-4 p-5 xl:grid-cols-[0.9fr_1.1fr]">
      <section className="space-y-4">
        <Panel title="Eval Cases" icon={FlaskConical}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <MiniStat label="Cases" value={String(cases.length)} />
              <MiniStat label="Pass rate" value={results.length ? `${passRate}%` : 'No runs'} />
            </div>
            <div className="flex items-center gap-2">
              <button onClick={onSeed} className="flex h-8 items-center gap-1.5 rounded-md border border-gray-700 bg-gray-900 px-3 text-xs text-gray-200 hover:border-cyan-500/50">
                <Sparkles size={13} /> Seed from API
              </button>
              <select value={provider} onChange={e => setProvider(e.target.value as 'active' | 'local')} className="h-8 rounded-md border border-gray-800 bg-gray-950 px-2 text-xs text-gray-300 outline-none">
                <option value="active">Active route</option>
                <option value="local">Local baseline</option>
              </select>
              <button onClick={onRun} disabled={running || !hasUser || cases.length === 0} className="ml-auto flex h-8 items-center gap-1.5 rounded-md bg-green-500 px-3 text-xs font-semibold text-gray-950 hover:bg-green-400 disabled:cursor-not-allowed disabled:opacity-50">
                {running ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
                Run
              </button>
            </div>
            {!hasUser && <Notice tone="amber" icon={AlertTriangle}>Sign in is required to run evals.</Notice>}
            <div className="rounded-md border border-gray-800 bg-gray-950/70 p-3">
              <div className="grid gap-2">
                <input value={newEval.name} onChange={e => setNewEval({ ...newEval, name: e.target.value })} className="h-8 rounded-md border border-gray-800 bg-gray-950 px-2 text-xs text-gray-200 outline-none focus:border-cyan-500/50" placeholder="Eval case name" />
                <textarea value={newEval.input} onChange={e => setNewEval({ ...newEval, input: e.target.value })} rows={4} className="resize-none rounded-md border border-gray-800 bg-gray-950 px-2 py-2 text-xs leading-5 text-gray-200 outline-none focus:border-cyan-500/50" placeholder="Prompt/input to test" />
                <div className="flex gap-2">
                  <input value={newEval.expected} onChange={e => setNewEval({ ...newEval, expected: e.target.value })} className="h-8 min-w-0 flex-1 rounded-md border border-gray-800 bg-gray-950 px-2 text-xs text-gray-200 outline-none focus:border-cyan-500/50" placeholder="Expected text or blank" />
                  <select value={newEval.scorer} onChange={e => setNewEval({ ...newEval, scorer: e.target.value as EvalScorer })} className="h-8 rounded-md border border-gray-800 bg-gray-950 px-2 text-xs text-gray-300 outline-none">
                    <option value="contains">Contains</option>
                    <option value="json">Valid JSON</option>
                    <option value="nonempty">Non-empty</option>
                  </select>
                  <button onClick={onAdd} className="flex h-8 items-center gap-1.5 rounded-md border border-gray-700 bg-gray-900 px-3 text-xs text-gray-200 hover:border-green-500/50">
                    <Plus size={13} /> Add
                  </button>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              {cases.map(item => (
                <div key={item.id} className="rounded-md border border-gray-800 bg-gray-950/60 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-xs font-semibold text-gray-200">{item.name}</div>
                      <div className="mt-1 line-clamp-2 text-[11px] leading-4 text-gray-500">{item.input}</div>
                    </div>
                    <button onClick={() => setCases(cases.filter(c => c.id !== item.id))} className="rounded p-1 text-gray-600 hover:bg-red-500/10 hover:text-red-300" title="Delete eval case">
                      <Trash2 size={13} />
                    </button>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="rounded bg-gray-800 px-1.5 py-0.5 text-[10px] text-gray-400">{item.scorer}</span>
                    {item.expected && <span className="truncate font-mono text-[10px] text-gray-600">expect: {item.expected}</span>}
                  </div>
                </div>
              ))}
              {!cases.length && <EmptyState icon={FlaskConical} title="No eval cases" body="Seed from the active API context or add the first case manually." />}
            </div>
          </div>
        </Panel>
      </section>

      <section className="space-y-4">
        <Panel title="Eval Runs" icon={BarChart3}>
          {results.length ? (
            <div className="space-y-2">
              {results.map(result => (
                <div key={result.id} className="rounded-md border border-gray-800 bg-gray-950/70 p-3">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      {result.passed ? <CheckCircle2 size={14} className="text-green-400" /> : <XCircle size={14} className="text-red-400" />}
                      <span className="truncate text-xs font-semibold text-gray-200">{result.caseName}</span>
                    </div>
                    <span className="font-mono text-[10px] text-gray-600">{result.provider} / {result.latencyMs} ms</span>
                  </div>
                  <div className={result.passed ? 'text-[11px] text-green-300' : 'text-[11px] text-red-300'}>{result.reason}</div>
                  <pre className="mt-2 max-h-[160px] overflow-auto whitespace-pre-wrap rounded border border-gray-800 bg-black/20 p-2 text-[11px] leading-5 text-gray-400">{result.output}</pre>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={BarChart3} title="No eval runs" body="Run saved cases to create pass/fail evidence for model, prompt, and API changes." />
          )}
        </Panel>
      </section>
    </div>
  );
}

function ToolsPane({
  request,
  response,
  format,
  setFormat,
  output,
  copied,
  onCopy,
  onDownload,
}: {
  request: RequestConfig | null;
  response: ResponseData | null;
  format: ToolFormat;
  setFormat: (format: ToolFormat) => void;
  output: string;
  copied: boolean;
  onCopy: () => void;
  onDownload: () => void;
}) {
  const options: Array<{ id: ToolFormat; label: string; icon: LucideIcon }> = [
    { id: 'openai', label: 'OpenAI tool', icon: FileJson },
    { id: 'mcp', label: 'MCP tool', icon: Code2 },
    { id: 'langchain', label: 'LangChain', icon: Code2 },
    { id: 'llamaindex', label: 'LlamaIndex', icon: Code2 },
    { id: 'crewai', label: 'CrewAI', icon: Code2 },
    { id: 'context', label: 'AI context', icon: ClipboardCheck },
    { id: 'curl', label: 'cURL', icon: TerminalSquare },
  ];
  return (
    <div className="grid min-h-full gap-4 p-5 xl:grid-cols-[260px_1fr]">
      <section className="space-y-4">
        <Panel title="Export Target" icon={Code2}>
          <div className="space-y-2">
            {options.map(option => (
              <button key={option.id} onClick={() => setFormat(option.id)} className={`flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-xs transition-colors ${format === option.id ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-200' : 'border-gray-800 bg-gray-950/60 text-gray-400 hover:border-gray-700 hover:text-gray-200'}`}>
                <option.icon size={14} />
                {option.label}
              </button>
            ))}
          </div>
        </Panel>
        <Panel title="Source" icon={ClipboardCheck}>
          {request ? (
            <div className="space-y-2 text-xs text-gray-400">
              <div className="flex items-center gap-2"><span className={`rounded border px-1.5 py-0.5 font-mono text-[10px] ${methodTone(request.method)}`}>{request.method}</span><span className="truncate text-gray-200">{request.name}</span></div>
              <div className="break-all font-mono text-[10px] leading-4 text-gray-500">{request.url}</div>
              <div>{response ? `Response context available: ${response.status}` : 'Run the request to include response context.'}</div>
            </div>
          ) : (
            <EmptyState icon={Code2} title="No request" body="Tool Builder needs an active request from the API Workbench." />
          )}
        </Panel>
      </section>
      <section className="space-y-4">
        <Panel title="Generated Artifact" icon={FileJson}>
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="text-xs text-gray-500">Secrets are redacted from generated agent artifacts.</div>
            <div className="flex items-center gap-2">
              <button onClick={onCopy} disabled={!output.trim()} className="flex h-8 items-center gap-1.5 rounded-md border border-gray-700 bg-gray-900 px-3 text-xs text-gray-200 hover:border-cyan-500/50 disabled:opacity-50">
                {copied ? <CheckCircle2 size={13} className="text-green-400" /> : <Copy size={13} />}
                {copied ? 'Copied' : 'Copy'}
              </button>
              <button onClick={onDownload} disabled={!output.trim()} className="flex h-8 items-center gap-1.5 rounded-md bg-cyan-500 px-3 text-xs font-semibold text-gray-950 hover:bg-cyan-400 disabled:opacity-50">
                <Download size={13} /> Download
              </button>
            </div>
          </div>
          <pre className="max-h-[calc(100vh-210px)] min-h-[480px] overflow-auto whitespace-pre-wrap rounded-md border border-gray-800 bg-black/30 p-4 text-xs leading-5 text-gray-300">{output}</pre>
        </Panel>
      </section>
    </div>
  );
}

function OpsPane({ llm, agent, providerConfigured, activeProvider, onOpenAgent, onOpenLlmSettings, onOpenSecurity }: {
  llm: LlmInfo | null;
  agent: AgentStatus | null;
  providerConfigured: boolean;
  activeProvider: string;
  onOpenAgent: () => void;
  onOpenLlmSettings: () => void;
  onOpenSecurity: () => void;
}) {
  return (
    <div className="grid gap-4 p-5 xl:grid-cols-3">
      <Panel title="Model Gateway" icon={KeyRound}>
        <div className="space-y-3">
          <CheckRow ok={providerConfigured} label="Active provider" detail={providerLabel[activeProvider] || activeProvider} />
          <CheckRow ok={!!llm?.config} label="User BYOK config" detail={llm?.config?.model_id || llm?.active_source || 'Server default'} />
          <CheckRow ok={activeProvider === 'local' || !!llm?.server_default?.configured} label="Server fallback" detail={llm?.server_default?.provider || 'Not loaded'} />
          <button onClick={onOpenLlmSettings} className="mt-2 flex h-9 w-full items-center justify-center gap-2 rounded-md bg-cyan-500 px-3 text-xs font-semibold text-gray-950 hover:bg-cyan-400">
            <Cpu size={14} /> Configure provider
          </button>
        </div>
      </Panel>
      <Panel title="Agent Loop" icon={Bot}>
        <div className="space-y-3">
          <CheckRow ok={!!agent?.aiEnabled} label="AI diagnosis" detail={agent?.aiEnabled ? 'Enabled' : 'Needs provider'} />
          <CheckRow ok={!!agent?.slackEnabled} label="Slack intake" detail={agent?.slackEnabled ? 'Connected' : 'Manual/test mode'} />
          <CheckRow ok={!!agent?.githubEnabled} label="PR handoff" detail={agent?.githubEnabled ? 'Connected' : 'Needs GitHub token'} />
          <button onClick={onOpenAgent} className="mt-2 flex h-9 w-full items-center justify-center gap-2 rounded-md border border-gray-700 bg-gray-900 px-3 text-xs text-gray-200 hover:border-purple-500/50">
            <Bot size={14} /> Open agent monitor
          </button>
        </div>
      </Panel>
      <Panel title="Enterprise Control" icon={Shield}>
        <div className="space-y-3">
          <CheckRow ok label="Workspace auth" detail="JWT, sessions, roles" />
          <CheckRow ok label="Credential encryption" detail="AES-256-GCM at rest" />
          <CheckRow ok label="Audit evidence" detail="Auth, AI, workspace actions" />
          <button onClick={onOpenSecurity} className="mt-2 flex h-9 w-full items-center justify-center gap-2 rounded-md border border-gray-700 bg-gray-900 px-3 text-xs text-gray-200 hover:border-blue-500/50">
            <Shield size={14} /> Security controls
          </button>
        </div>
      </Panel>
    </div>
  );
}

function Panel({ title, icon: Icon, children }: { title: string; icon: LucideIcon; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-gray-800 bg-gray-900/40">
      <div className="flex items-center gap-2 border-b border-gray-800 px-4 py-3">
        <Icon size={15} className="text-cyan-300" />
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-300">{title}</h3>
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function NavButton({ active, icon: Icon, label, onClick }: { active: boolean; icon: LucideIcon; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`flex h-9 w-full items-center gap-2 rounded-md px-3 text-left text-xs transition-colors ${active ? 'bg-cyan-500/10 text-cyan-200 ring-1 ring-cyan-500/20' : 'text-gray-500 hover:bg-gray-900 hover:text-gray-200'}`}>
      <Icon size={14} />
      {label}
    </button>
  );
}

function Metric({ icon: Icon, label, value, tone }: { icon: LucideIcon; label: string; value: string; tone: 'cyan' | 'green' | 'amber' | 'blue' | 'gray' }) {
  const tones = {
    cyan: 'text-cyan-300 bg-cyan-500/10 border-cyan-500/20',
    green: 'text-green-300 bg-green-500/10 border-green-500/20',
    amber: 'text-amber-300 bg-amber-500/10 border-amber-500/20',
    blue: 'text-blue-300 bg-blue-500/10 border-blue-500/20',
    gray: 'text-gray-300 bg-gray-500/10 border-gray-500/20',
  };
  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900/40 p-3">
      <div className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
        <span className={`flex h-6 w-6 items-center justify-center rounded-md border ${tones[tone]}`}><Icon size={13} /></span>
        {label}
      </div>
      <div className="truncate text-sm font-semibold text-gray-100">{value}</div>
    </div>
  );
}

function WorkCard({ icon: Icon, title, label, detail, cta, onClick }: { icon: LucideIcon; title: string; label: string; detail: string; cta: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="min-h-[170px] rounded-lg border border-gray-800 bg-gray-900/40 p-4 text-left transition-colors hover:border-cyan-500/40 hover:bg-gray-900">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-100"><Icon size={16} className="text-cyan-300" /> {title}</div>
        <span className="rounded bg-gray-800 px-2 py-0.5 text-[10px] text-gray-500">{cta}</span>
      </div>
      <div className="mb-2 text-xs font-semibold text-gray-300">{label}</div>
      <p className="text-xs leading-5 text-gray-500">{detail}</p>
    </button>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-gray-800 bg-gray-950/70 p-2">
      <div className="text-[10px] uppercase tracking-wide text-gray-600">{label}</div>
      <div className="mt-1 truncate font-mono text-xs text-gray-200">{value}</div>
    </div>
  );
}

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`hidden items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] md:flex ${ok ? 'border-green-500/20 bg-green-500/10 text-green-300' : 'border-amber-500/20 bg-amber-500/10 text-amber-300'}`}>
      {ok ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
      {label}
    </span>
  );
}

function Toggle({ checked, onChange, label, disabled = false }: { checked: boolean; onChange: (checked: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <label className={`flex h-8 items-center gap-2 rounded-md border border-gray-800 bg-gray-950 px-3 text-xs ${disabled ? 'cursor-not-allowed text-gray-700' : 'cursor-pointer text-gray-300'}`}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} disabled={disabled} className="h-3.5 w-3.5 accent-cyan-400" />
      {label}
    </label>
  );
}

function FieldLabel({ label }: { label: string }) {
  return <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">{label}</div>;
}

function Notice({ tone, icon: Icon, children }: { tone: 'amber' | 'red'; icon: LucideIcon; children: ReactNode }) {
  const cls = tone === 'red' ? 'border-red-500/20 bg-red-500/10 text-red-200' : 'border-amber-500/20 bg-amber-500/10 text-amber-200';
  return <div className={`flex items-start gap-2 rounded-md border px-3 py-2 text-xs ${cls}`}><Icon size={14} className="mt-0.5 shrink-0" /><span>{children}</span></div>;
}

function EmptyState({ icon: Icon, title, body, action, onAction }: { icon: LucideIcon; title: string; body: string; action?: string; onAction?: () => void }) {
  return (
    <div className="flex min-h-[180px] flex-col items-center justify-center rounded-md border border-dashed border-gray-800 bg-gray-950/40 p-5 text-center">
      <Icon size={22} className="mb-3 text-gray-600" />
      <div className="text-sm font-semibold text-gray-300">{title}</div>
      <div className="mt-1 max-w-[34ch] text-xs leading-5 text-gray-600">{body}</div>
      {action && onAction && <button onClick={onAction} className="mt-4 rounded-md bg-cyan-500 px-3 py-2 text-xs font-semibold text-gray-950 hover:bg-cyan-400">{action}</button>}
    </div>
  );
}

function LoopStep({ ok, label }: { ok: boolean; label: string }) {
  return <div className="flex items-center gap-2 text-xs text-gray-400">{ok ? <CheckCircle2 size={13} className="text-green-400" /> : <XCircle size={13} className="text-gray-600" />}<span>{label}</span></div>;
}

function CheckRow({ ok, label, detail }: { ok: boolean; label: string; detail: string }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-gray-800 bg-gray-950/60 p-3">
      {ok ? <CheckCircle2 size={15} className="mt-0.5 text-green-400" /> : <AlertTriangle size={15} className="mt-0.5 text-amber-400" />}
      <div className="min-w-0">
        <div className="text-xs font-semibold text-gray-200">{label}</div>
        <div className="mt-0.5 truncate text-[11px] text-gray-500">{detail}</div>
      </div>
    </div>
  );
}
