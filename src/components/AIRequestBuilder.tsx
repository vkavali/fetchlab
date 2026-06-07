import { useState, useEffect, useRef } from 'react';
import { useApp } from '../store/useApp';
import { parseCurl } from '../utils/curlParser';
import { aiPost, getAiStatus, type AiRequestSpec } from '../utils/aiClient';
import { generateId } from '../utils/helpers';
import type { HttpMethod, KeyValue, RequestConfig } from '../types';
import {
  Sparkles, Wand2, Terminal, Loader2, X, ArrowRight, AlertTriangle,
} from 'lucide-react';

interface Props {
  onClose: () => void;
}

const EXAMPLES = [
  'GET all users from the GitHub API with auth token',
  'POST to Stripe to create a payment intent for $10',
  'Search the OpenAI API for completions with prompt "hello world"',
  'GET the weather for San Francisco from OpenWeatherMap',
];

export default function AIRequestBuilder({ onClose }: Props) {
  const { dispatch } = useApp();
  const [mode, setMode] = useState<'nl' | 'curl'>('nl');
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiEnabled, setAiEnabled] = useState<boolean | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    getAiStatus().then(s => setAiEnabled(s.enabled));
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  const buildRequestFromCurl = () => {
    setError(null);
    const parsed = parseCurl(input);
    if (!parsed) {
      setError('Could not parse cURL command. Make sure it starts with "curl".');
      return;
    }
    openParsed(parsed);
  };

  const buildRequestFromNL = async () => {
    if (!input.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const spec = await aiPost<AiRequestSpec>('/api/ai/generate-request', { prompt: input });
      const req = specToRequest(spec);
      openParsed(req);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI generation failed');
    } finally {
      setLoading(false);
    }
  };

  const openParsed = (req: Partial<RequestConfig>) => {
    const fullReq: RequestConfig = {
      id: generateId(),
      name: req.name || 'AI generated',
      method: (req.method as HttpMethod) || 'GET',
      url: req.url || '',
      params: req.params?.length ? req.params : [{ id: generateId(), key: '', value: '', enabled: true }],
      headers: req.headers?.length ? req.headers : [{ id: generateId(), key: '', value: '', enabled: true }],
      body: req.body || { type: 'none', content: '', formData: [] },
      auth: req.auth || { type: 'none' },
    };
    dispatch({ type: 'OPEN_REQUEST', request: fullReq });
    onClose();
  };

  const handleSubmit = () => {
    if (mode === 'curl') buildRequestFromCurl();
    else buildRequestFromNL();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-[640px] max-w-[95vw] flex flex-col animate-slide-in"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center">
              <Sparkles size={16} className="text-white" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-100">AI Request Builder</h2>
              <p className="text-[10px] text-gray-500">Describe in plain English or paste a cURL command</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-500 hover:text-gray-300">
            <X size={16} />
          </button>
        </div>

        {/* Mode tabs */}
        <div className="flex items-center gap-1 px-4 pt-3">
          <button
            onClick={() => setMode('nl')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              mode === 'nl'
                ? 'bg-brand-500/20 text-brand-400 ring-1 ring-brand-500/30'
                : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800'
            }`}
          >
            <Wand2 size={12} />
            Natural language
          </button>
          <button
            onClick={() => setMode('curl')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              mode === 'curl'
                ? 'bg-green-500/20 text-green-400 ring-1 ring-green-500/30'
                : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800'
            }`}
          >
            <Terminal size={12} />
            Paste cURL
          </button>
        </div>

        {/* Input area */}
        <div className="p-4 space-y-3">
          {mode === 'nl' && aiEnabled === false && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
              <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">AI features are not configured</p>
                <p className="text-amber-300/70 mt-0.5">
                  Set the <code className="px-1 py-0.5 rounded bg-amber-500/10 font-mono">ANTHROPIC_API_KEY</code> environment variable
                  on the server to enable natural-language request generation. cURL parsing still works without it.
                </p>
              </div>
            </div>
          )}

          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={
              mode === 'nl'
                ? 'e.g. GET all repositories for user octocat from GitHub'
                : "curl -X POST 'https://api.example.com/users' -H 'Content-Type: application/json' -d '{\"name\":\"foo\"}'"
            }
            rows={mode === 'nl' ? 3 : 6}
            className={`w-full bg-gray-800/50 border border-gray-700 rounded-lg px-3 py-2.5 text-sm font-mono text-gray-200 placeholder-gray-600 focus:outline-none transition-colors resize-none ${
              mode === 'nl' ? 'focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/20' : 'focus:border-green-500/50 focus:ring-1 focus:ring-green-500/20'
            }`}
          />

          {mode === 'nl' && (
            <div className="flex flex-wrap gap-1.5">
              {EXAMPLES.map(ex => (
                <button
                  key={ex}
                  onClick={() => setInput(ex)}
                  className="px-2 py-1 rounded-md text-[10px] text-gray-500 bg-gray-800/50 hover:text-brand-300 hover:bg-brand-500/10 transition-colors"
                >
                  {ex}
                </button>
              ))}
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-300">
              <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-800">
          <span className="text-[10px] text-gray-600">
            <kbd className="px-1.5 py-0.5 rounded bg-gray-800 border border-gray-700 text-gray-500">Ctrl+Enter</kbd> to generate
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg text-xs text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading || !input.trim() || (mode === 'nl' && aiEnabled === false)}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                mode === 'nl'
                  ? 'bg-brand-600 hover:bg-brand-500'
                  : 'bg-green-600 hover:bg-green-500'
              }`}
            >
              {loading ? <Loader2 size={12} className="animate-spin" /> : <ArrowRight size={12} />}
              {loading ? 'Generating...' : 'Generate request'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function specToRequest(spec: AiRequestSpec): Partial<RequestConfig> {
  const headers: KeyValue[] = (spec.headers || [])
    .filter(h => h?.key)
    .map(h => ({ id: generateId(), key: h.key, value: h.value || '', enabled: true }));
  const params: KeyValue[] = (spec.params || [])
    .filter(p => p?.key)
    .map(p => ({ id: generateId(), key: p.key, value: p.value || '', enabled: true }));

  const bodyType = spec.body?.type as RequestConfig['body']['type'] | undefined;
  const validTypes: RequestConfig['body']['type'][] = ['none', 'json', 'form-data', 'x-www-form-urlencoded', 'raw', 'binary', 'graphql'];
  const finalBodyType: RequestConfig['body']['type'] = bodyType && validTypes.includes(bodyType) ? bodyType : 'none';

  return {
    method: (spec.method as HttpMethod) || 'GET',
    url: spec.url || '',
    name: spec.name || 'AI generated',
    headers,
    params,
    body: {
      type: finalBodyType,
      content: spec.body?.content || '',
      formData: [],
    },
  };
}
