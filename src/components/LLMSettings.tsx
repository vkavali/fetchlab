import { useCallback, useEffect, useState } from 'react';
import { X, Save, Trash2, PlayCircle, CheckCircle2, AlertCircle, Shield, Cloud, Globe, Server, Cpu, Loader2 } from 'lucide-react';
import { useAuth } from '../auth/useAuth';

type Provider = 'anthropic' | 'bedrock' | 'vertex' | 'openai' | 'local';

interface ConfigResponse {
  config: {
    provider: Provider;
    has_api_key: boolean;
    api_key_preview: string;
    base_url: string;
    model_id: string;
    region: string;
    project_id: string;
    location: string;
    extra_config: Record<string, unknown>;
    updated_at: string;
  } | null;
  server_default: { provider: Provider; configured: boolean };
  providers: Provider[];
  active_source: 'byok' | 'server';
  active_provider: Provider;
}

const PROVIDER_LABELS: Record<Provider, string> = {
  anthropic: 'Anthropic (Direct)',
  bedrock: 'AWS Bedrock',
  vertex: 'Google Vertex AI',
  openai: 'OpenAI Compatible',
  local: 'Local (No AI)',
};

const PROVIDER_ICONS: Record<Provider, React.ReactNode> = {
  anthropic: <Cpu size={14} />,
  bedrock: <Cloud size={14} />,
  vertex: <Globe size={14} />,
  openai: <Server size={14} />,
  local: <Shield size={14} />,
};

const RETENTION_NOTICE: Record<Provider, string> = {
  anthropic: 'Data processed by Anthropic. Enterprise plans include zero data retention.',
  bedrock: 'Data stays within your AWS account. No data sent to Anthropic directly.',
  vertex: 'Data stays within your GCP project.',
  openai: 'Data sent to your configured endpoint.',
  local: 'No external AI calls. Basic heuristic analysis only.',
};

interface Props {
  onClose: () => void;
}

export default function LLMSettings({ onClose }: Props) {
  const { authFetch } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [info, setInfo] = useState<ConfigResponse | null>(null);
  const [provider, setProvider] = useState<Provider>('anthropic');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [modelId, setModelId] = useState('');
  const [region, setRegion] = useState('');
  const [projectId, setProjectId] = useState('');
  const [location, setLocation] = useState('');
  const [awsSecret, setAwsSecret] = useState('');
  const [credentialsJson, setCredentialsJson] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [clientSideMode, setClientSideMode] = useState(() => {
    try { return localStorage.getItem('fetchlab_llm_clientside') === '1'; } catch { return false; }
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch('/api/settings/llm');
      if (!res.ok) throw new Error(`Failed to load: ${res.status}`);
      const data: ConfigResponse = await res.json();
      setInfo(data);
      if (data.config) {
        setProvider(data.config.provider);
        setBaseUrl(data.config.base_url);
        setModelId(data.config.model_id);
        setRegion(data.config.region);
        setProjectId(data.config.project_id);
        setLocation(data.config.location);
      } else {
        setProvider(data.server_default.provider || 'anthropic');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    load();
  }, [load]);

  function clearForm() {
    setApiKey('');
    setAwsSecret('');
    setCredentialsJson('');
    setError(null);
    setSuccess(null);
    setTestResult(null);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const extra_config: Record<string, string> = {};
      if (provider === 'bedrock' && awsSecret) extra_config.aws_secret_access_key = awsSecret;
      if (provider === 'vertex' && credentialsJson) extra_config.credentials_json = credentialsJson;

      const body: Record<string, unknown> = { provider, extra_config };
      if (apiKey) body.api_key = apiKey;
      if (baseUrl) body.base_url = baseUrl;
      if (modelId) body.model_id = modelId;
      if (region) body.region = region;
      if (projectId) body.project_id = projectId;
      if (location) body.location = location;

      const res = await authFetch('/api/settings/llm', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed: ${res.status}`);
      setSuccess('Configuration saved.');
      setApiKey('');
      setAwsSecret('');
      setCredentialsJson('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm('Remove your LLM configuration? AI calls will fall back to the server default.')) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await authFetch('/api/settings/llm', { method: 'DELETE', credentials: 'include' });
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      setSuccess('Configuration removed.');
      clearForm();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await authFetch('/api/settings/llm/test', { method: 'POST', credentials: 'include' });
      const data = await res.json();
      if (res.ok && data.ok) {
        setTestResult({ ok: true, message: `${data.provider} → ${data.model || 'ok'} — "${(data.preview || '').slice(0, 80)}"` });
      } else {
        setTestResult({ ok: false, message: data.error || `Failed: ${res.status}` });
      }
    } catch (e) {
      setTestResult({ ok: false, message: e instanceof Error ? e.message : String(e) });
    } finally {
      setTesting(false);
    }
  }

  function toggleClientSide() {
    const next = !clientSideMode;
    setClientSideMode(next);
    try { localStorage.setItem('fetchlab_llm_clientside', next ? '1' : '0'); } catch { /* ignore */ }
  }

  const activeBadge = info?.active_source === 'byok'
    ? <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-500/15 text-purple-400">YOUR KEY</span>
    : <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-500/15 text-blue-400">SERVER DEFAULT</span>;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="bg-gray-950 border border-gray-800 rounded-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <header className="flex items-center justify-between px-5 py-3 border-b border-gray-800 sticky top-0 bg-gray-950">
          <div className="flex items-center gap-2">
            <Shield size={16} className="text-purple-400" />
            <h2 className="text-sm font-semibold text-gray-100">LLM Provider & BYOK</h2>
            {info && activeBadge}
          </div>
          <button onClick={onClose} className="p-1 rounded text-gray-500 hover:text-gray-200 hover:bg-gray-800">
            <X size={16} />
          </button>
        </header>

        <div className="p-5 space-y-5">
          {loading ? (
            <div className="flex items-center gap-2 text-gray-400 text-sm">
              <Loader2 size={14} className="animate-spin" /> Loading…
            </div>
          ) : (
            <>
              {info?.config && (
                <div className="rounded-lg bg-purple-500/5 border border-purple-500/20 p-3 text-xs">
                  <div className="font-semibold text-purple-300 mb-1">Active: {PROVIDER_LABELS[info.config.provider]}</div>
                  <div className="text-gray-400">
                    {info.config.has_api_key && <>Key: <code className="text-gray-300">{info.config.api_key_preview}</code> · </>}
                    {info.config.model_id && <>Model: <code className="text-gray-300">{info.config.model_id}</code></>}
                  </div>
                </div>
              )}
              {!info?.config && info?.server_default && (
                <div className="rounded-lg bg-blue-500/5 border border-blue-500/20 p-3 text-xs text-gray-400">
                  Using server default: <strong className="text-blue-300">{PROVIDER_LABELS[info.server_default.provider]}</strong>
                  {!info.server_default.configured && info.server_default.provider !== 'local' && (
                    <span className="block mt-1 text-amber-400">⚠ Server has no API key configured. Set one below or contact your admin.</span>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Provider</label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {(['anthropic', 'bedrock', 'vertex', 'openai', 'local'] as Provider[]).map(p => (
                    <button
                      key={p}
                      onClick={() => { setProvider(p); clearForm(); }}
                      className={`flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs font-medium border transition-colors ${
                        provider === p
                          ? 'bg-purple-500/15 border-purple-500/40 text-purple-300'
                          : 'bg-gray-900 border-gray-800 text-gray-400 hover:text-gray-200 hover:border-gray-700'
                      }`}
                    >
                      {PROVIDER_ICONS[p]}
                      <span className="hidden sm:inline">{PROVIDER_LABELS[p]}</span>
                      <span className="sm:hidden">{p}</span>
                    </button>
                  ))}
                </div>
              </div>

              <ProviderFields
                provider={provider}
                apiKey={apiKey} setApiKey={setApiKey}
                baseUrl={baseUrl} setBaseUrl={setBaseUrl}
                modelId={modelId} setModelId={setModelId}
                region={region} setRegion={setRegion}
                projectId={projectId} setProjectId={setProjectId}
                location={location} setLocation={setLocation}
                awsSecret={awsSecret} setAwsSecret={setAwsSecret}
                credentialsJson={credentialsJson} setCredentialsJson={setCredentialsJson}
                existingKeyPreview={info?.config?.provider === provider ? info.config.api_key_preview : ''}
              />

              <div className="rounded-lg bg-gray-900/50 border border-gray-800 p-3 text-xs text-gray-400">
                <div className="flex items-start gap-2">
                  <Shield size={12} className="mt-0.5 text-gray-500" />
                  <span>{RETENTION_NOTICE[provider]}</span>
                </div>
              </div>

              <div className="rounded-lg bg-gray-900/50 border border-gray-800 p-3 text-xs">
                <label className="flex items-center gap-2 cursor-pointer text-gray-300">
                  <input
                    type="checkbox"
                    checked={clientSideMode}
                    onChange={toggleClientSide}
                    className="accent-purple-500"
                  />
                  <span className="font-medium">Run AI calls from the client (desktop app only)</span>
                </label>
                <p className="mt-1.5 text-gray-500 leading-relaxed">
                  When enabled in the desktop build, AI requests go directly from your machine to the LLM endpoint —
                  the FetchLab server is never involved. Falls back to the server route when client-side calls aren't configured.
                </p>
              </div>

              {error && (
                <div className="flex items-start gap-2 rounded-lg bg-red-500/10 border border-red-500/30 p-3 text-xs text-red-300">
                  <AlertCircle size={14} className="mt-0.5" />
                  <span>{error}</span>
                </div>
              )}
              {success && (
                <div className="flex items-center gap-2 rounded-lg bg-green-500/10 border border-green-500/30 p-3 text-xs text-green-300">
                  <CheckCircle2 size={14} />
                  <span>{success}</span>
                </div>
              )}
              {testResult && (
                <div className={`flex items-start gap-2 rounded-lg p-3 text-xs border ${
                  testResult.ok ? 'bg-green-500/10 border-green-500/30 text-green-300' : 'bg-red-500/10 border-red-500/30 text-red-300'
                }`}>
                  {testResult.ok ? <CheckCircle2 size={14} className="mt-0.5" /> : <AlertCircle size={14} className="mt-0.5" />}
                  <span>{testResult.message}</span>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-gray-800">
                <button
                  onClick={handleTest}
                  disabled={testing || saving}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs text-gray-200 disabled:opacity-50"
                >
                  {testing ? <Loader2 size={12} className="animate-spin" /> : <PlayCircle size={12} />}
                  Test Connection
                </button>
                <div className="flex items-center gap-2">
                  {info?.config && (
                    <button
                      onClick={handleDelete}
                      disabled={saving}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-xs text-red-300 disabled:opacity-50"
                    >
                      <Trash2 size={12} /> Remove
                    </button>
                  )}
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-purple-500 hover:bg-purple-400 text-xs text-white font-medium disabled:opacity-50"
                  >
                    {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                    Save
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

interface FieldsProps {
  provider: Provider;
  apiKey: string; setApiKey: (v: string) => void;
  baseUrl: string; setBaseUrl: (v: string) => void;
  modelId: string; setModelId: (v: string) => void;
  region: string; setRegion: (v: string) => void;
  projectId: string; setProjectId: (v: string) => void;
  location: string; setLocation: (v: string) => void;
  awsSecret: string; setAwsSecret: (v: string) => void;
  credentialsJson: string; setCredentialsJson: (v: string) => void;
  existingKeyPreview: string;
}

function ProviderFields(p: FieldsProps) {
  const keyPlaceholder = p.existingKeyPreview
    ? `Leave blank to keep current (${p.existingKeyPreview})`
    : '';
  switch (p.provider) {
    case 'anthropic':
      return (
        <div className="space-y-2">
          <Field label="API Key" type="password" value={p.apiKey} onChange={p.setApiKey} placeholder={keyPlaceholder || 'sk-ant-...'} />
          <Field label="Model" value={p.modelId} onChange={p.setModelId} placeholder="claude-sonnet-4-6" />
        </div>
      );
    case 'bedrock':
      return (
        <div className="space-y-2">
          <Field label="AWS Access Key ID" value={p.apiKey} onChange={p.setApiKey} placeholder={keyPlaceholder || 'AKIA...'} />
          <Field label="AWS Secret Access Key" type="password" value={p.awsSecret} onChange={p.setAwsSecret} placeholder="••••••••" />
          <Field label="Region" value={p.region} onChange={p.setRegion} placeholder="us-east-1" />
          <Field label="Model ID" value={p.modelId} onChange={p.setModelId} placeholder="anthropic.claude-3-5-sonnet-20241022-v2:0" />
        </div>
      );
    case 'vertex':
      return (
        <div className="space-y-2">
          <Field label="GCP Project ID" value={p.projectId} onChange={p.setProjectId} placeholder="my-project-123" />
          <Field label="Location" value={p.location} onChange={p.setLocation} placeholder="us-east5" />
          <Field label="Model ID" value={p.modelId} onChange={p.setModelId} placeholder="claude-sonnet-4-6@20250514" />
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Service Account JSON (optional)</label>
            <textarea
              value={p.credentialsJson}
              onChange={e => p.setCredentialsJson(e.target.value)}
              rows={4}
              placeholder='{"type":"service_account",...} — leave blank to use Application Default Credentials'
              className="w-full px-3 py-2 rounded-lg bg-gray-900 border border-gray-800 text-xs text-gray-200 focus:outline-none focus:border-purple-500/50 font-mono"
            />
          </div>
        </div>
      );
    case 'openai':
      return (
        <div className="space-y-2">
          <Field label="API Key" type="password" value={p.apiKey} onChange={p.setApiKey} placeholder={keyPlaceholder || 'sk-...'} />
          <Field label="Base URL" value={p.baseUrl} onChange={p.setBaseUrl} placeholder="https://api.openai.com/v1" />
          <Field label="Model" value={p.modelId} onChange={p.setModelId} placeholder="gpt-4o-mini, llama3:8b, ..." />
        </div>
      );
    case 'local':
      return (
        <div className="rounded-lg bg-gray-900/50 border border-gray-800 p-3 text-xs text-gray-400">
          No configuration needed. The local provider uses heuristic pattern-matching and never makes external calls.
        </div>
      );
    default:
      return null;
  }
}

function Field({ label, value, onChange, placeholder, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-400 mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 rounded-lg bg-gray-900 border border-gray-800 text-xs text-gray-200 focus:outline-none focus:border-purple-500/50"
      />
    </div>
  );
}
