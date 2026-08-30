import { useEffect, useState } from 'react';
import { Bot, Cpu, Gauge, GitPullRequest, KeyRound, Shield, TestTube2, X } from 'lucide-react';
import { useAuth } from '../auth/useAuth';

interface Props {
  onClose: () => void;
  onOpenAgent: () => void;
  onOpenLlmSettings: () => void;
  onOpenSecurity: () => void;
}

interface LlmInfo {
  active_provider?: string;
  server_default?: { provider?: string; configured?: boolean };
}

interface AgentStatus {
  aiEnabled?: boolean;
  slackEnabled?: boolean;
  githubEnabled?: boolean;
}

const providerLabel: Record<string, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI Compatible',
  bedrock: 'AWS Bedrock',
  vertex: 'Google Vertex AI',
  local: 'Local',
};

export default function AIWorkbench({ onClose, onOpenAgent, onOpenLlmSettings, onOpenSecurity }: Props) {
  const { authFetch, activeWorkspaceId } = useAuth();
  const [llm, setLlm] = useState<LlmInfo | null>(null);
  const [agent, setAgent] = useState<AgentStatus | null>(null);

  useEffect(() => {
    let alive = true;
    async function load() {
      const [llmRes, agentRes] = await Promise.allSettled([
        authFetch('/api/settings/llm'),
        authFetch('/api/agent/status'),
      ]);
      if (!alive) return;
      if (llmRes.status === 'fulfilled' && llmRes.value.ok) setLlm(await llmRes.value.json());
      if (agentRes.status === 'fulfilled' && agentRes.value.ok) setAgent(await agentRes.value.json());
    }
    load();
    return () => { alive = false; };
  }, [authFetch, activeWorkspaceId]);

  const activeProvider = llm?.active_provider || llm?.server_default?.provider || 'local';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-[960px] max-w-[94vw] max-h-[90vh] overflow-hidden rounded-lg border border-gray-800 bg-gray-950 shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-800 px-5 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded bg-purple-500/10 text-purple-300">
              <Cpu size={17} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-100">AI Workbench</h2>
              <div className="text-[11px] text-gray-500">Workspace control for models, agents, evals, and coding flows</div>
            </div>
          </div>
          <button onClick={onClose} className="rounded p-1.5 text-gray-500 hover:bg-gray-800 hover:text-gray-200" title="Close">
            <X size={16} />
          </button>
        </div>

        <div className="grid gap-4 p-5 lg:grid-cols-[1.35fr_0.85fr]">
          <section className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Metric icon={Cpu} label="Active model route" value={providerLabel[activeProvider] || activeProvider} tone="purple" />
              <Metric icon={Bot} label="Agent monitor" value={agent?.aiEnabled ? 'Ready' : 'Needs provider'} tone={agent?.aiEnabled ? 'green' : 'amber'} />
              <Metric icon={Shield} label="Security posture" value="Workspace policy" tone="blue" />
              <Metric icon={Gauge} label="Gateway mode" value="BYOK + server default" tone="cyan" />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <ActionCard icon={KeyRound} title="Model Gateway" status={llm?.server_default?.configured ? 'Server default configured' : 'Configure provider'} detail="Anthropic, OpenAI-compatible, Bedrock, Vertex, and local routing." onClick={onOpenLlmSettings} />
              <ActionCard icon={Bot} title="Agent Monitor" status={agent?.slackEnabled ? 'Slack connected' : 'Detector available'} detail="Slack/API incident detection, reproduction, diagnosis, and PR handoff." onClick={onOpenAgent} />
              <ActionCard icon={TestTube2} title="Evals" status="Next build slice" detail="Turn request history and AI outputs into regression suites." />
              <ActionCard icon={GitPullRequest} title="Coding Agents" status={agent?.githubEnabled ? 'GitHub connected' : 'Needs GitHub token'} detail="Use API collections as source-of-truth for generated tests and fixes." onClick={onOpenAgent} />
            </div>
          </section>

          <aside className="space-y-3 rounded-lg border border-gray-800 bg-gray-900/40 p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">Two Bench Model</div>
            <BenchRow title="API Workbench" items={["Requests", "Collections", "Environments", "WebSocket/SSE", "OpenAPI"]} />
            <BenchRow title="AI Workbench" items={["Providers", "Gateway", "Evals", "Agents", "Coding flows"]} />
            <button onClick={onOpenSecurity} className="mt-2 flex w-full items-center justify-center gap-2 rounded border border-gray-700 bg-gray-900 px-3 py-2 text-xs font-medium text-gray-200 hover:border-blue-500/50 hover:bg-blue-500/10">
              <Shield size={13} /> Security controls
            </button>
          </aside>
        </div>
      </div>
    </div>
  );
}

function Metric({ icon: Icon, label, value, tone }: { icon: typeof Cpu; label: string; value: string; tone: 'purple' | 'green' | 'amber' | 'blue' | 'cyan' }) {
  const tones = {
    purple: 'text-purple-300 bg-purple-500/10',
    green: 'text-green-300 bg-green-500/10',
    amber: 'text-amber-300 bg-amber-500/10',
    blue: 'text-blue-300 bg-blue-500/10',
    cyan: 'text-cyan-300 bg-cyan-500/10',
  };
  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900/40 p-3">
      <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-wide text-gray-500">
        <span className={`flex h-6 w-6 items-center justify-center rounded ${tones[tone]}`}><Icon size={13} /></span>
        {label}
      </div>
      <div className="truncate text-sm font-semibold text-gray-100">{value}</div>
    </div>
  );
}

function ActionCard({ icon: Icon, title, status, detail, onClick }: { icon: typeof Cpu; title: string; status: string; detail: string; onClick?: () => void }) {
  return (
    <button onClick={onClick} disabled={!onClick} className="min-h-[132px] rounded-lg border border-gray-800 bg-gray-900/40 p-4 text-left transition-colors hover:border-purple-500/40 hover:bg-gray-900 disabled:cursor-default disabled:hover:border-gray-800 disabled:hover:bg-gray-900/40">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-100"><Icon size={15} className="text-purple-300" /> {title}</div>
        <span className="rounded bg-gray-800 px-2 py-0.5 text-[10px] text-gray-400">{status}</span>
      </div>
      <p className="text-xs leading-5 text-gray-500">{detail}</p>
    </button>
  );
}

function BenchRow({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded border border-gray-800 bg-gray-950/60 p-3">
      <div className="mb-2 text-xs font-semibold text-gray-200">{title}</div>
      <div className="flex flex-wrap gap-1.5">
        {items.map(item => <span key={item} className="rounded bg-gray-800 px-2 py-1 text-[10px] text-gray-400">{item}</span>)}
      </div>
    </div>
  );
}
