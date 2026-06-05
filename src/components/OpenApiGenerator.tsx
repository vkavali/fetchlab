import { useEffect, useState } from 'react';
import { useApp } from '../store/useApp';
import type { Collection, RequestConfig } from '../types';
import { aiPost, getAiStatus } from '../utils/aiClient';
import {
  X, Sparkles, Loader2, Copy, Download, Check, AlertTriangle, FileCode,
} from 'lucide-react';

interface Props {
  collection: Collection;
  onClose: () => void;
}

interface RequestSummary {
  name: string;
  method: string;
  url: string;
  headers: { key: string; value: string }[];
  params: { key: string; value: string }[];
  body: string;
  responseStatus?: number;
  responseSample?: string;
}

export default function OpenApiGenerator({ collection, onClose }: Props) {
  const { state } = useApp();
  const [yaml, setYaml] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiEnabled, setAiEnabled] = useState<boolean | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    getAiStatus().then(s => setAiEnabled(s.enabled));
  }, []);

  const buildRequestSummaries = (): RequestSummary[] => {
    return collection.requests.map(req => {
      // Find the most recent matching response in history
      const historyMatch = state.history.find(
        h => h.request.method === req.method && h.request.url === req.url
      );
      return summarizeRequest(req, historyMatch?.response?.status, historyMatch?.response?.body);
    });
  };

  const generate = async () => {
    setLoading(true);
    setError(null);
    setYaml(null);
    try {
      const requests = buildRequestSummaries();
      const result = await aiPost<{ yaml: string }>('/api/ai/generate-spec', {
        collectionName: collection.name,
        requests,
      });
      setYaml(result.yaml);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI spec generation failed');
    } finally {
      setLoading(false);
    }
  };

  const copyYaml = () => {
    if (!yaml) return;
    navigator.clipboard.writeText(yaml);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadYaml = () => {
    if (!yaml) return;
    const blob = new Blob([yaml], { type: 'application/x-yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${collection.name.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'openapi'}.openapi.yaml`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const requestCount = collection.requests.length;
  const withResponses = buildRequestSummaries().filter(r => r.responseStatus).length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-[860px] max-w-[95vw] max-h-[88vh] flex flex-col animate-slide-in"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center">
              <FileCode size={16} className="text-white" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-100">Generate OpenAPI Spec</h2>
              <p className="text-[10px] text-gray-500">
                <span className="text-gray-400">{collection.name}</span> — {requestCount} requests · {withResponses} with captured responses
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-500 hover:text-gray-300">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {aiEnabled === false && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
              <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">AI features are not configured</p>
                <p className="text-amber-300/70 mt-0.5">
                  Set <code className="px-1 py-0.5 rounded bg-amber-500/10 font-mono">ANTHROPIC_API_KEY</code> on the server to enable spec generation.
                </p>
              </div>
            </div>
          )}

          {!yaml && !loading && (
            <div className="text-center py-12">
              <Sparkles size={28} className="mx-auto text-purple-400 mb-3" />
              <p className="text-sm text-gray-300 font-medium">
                Generate an OpenAPI 3.0 spec from this collection
              </p>
              <p className="text-xs text-gray-500 mt-1.5 max-w-md mx-auto">
                FetchLab will analyze {requestCount} request{requestCount === 1 ? '' : 's'}
                {withResponses > 0 ? ` and ${withResponses} captured response${withResponses === 1 ? '' : 's'}` : ''} to infer paths, parameters, and schemas.
              </p>
              <button
                onClick={generate}
                disabled={requestCount === 0 || aiEnabled === false}
                className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-400 hover:to-pink-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <Sparkles size={14} />
                Generate spec
              </button>
            </div>
          )}

          {loading && (
            <div className="text-center py-12">
              <Loader2 size={28} className="mx-auto text-purple-400 animate-spin mb-3" />
              <p className="text-sm text-gray-300">Analyzing traffic and generating OpenAPI YAML…</p>
              <p className="text-[11px] text-gray-500 mt-1">This usually takes 5–15 seconds</p>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-300">
              <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {yaml && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">openapi.yaml</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={generate}
                    disabled={loading}
                    className="flex items-center gap-1 px-2 py-1 rounded text-[11px] text-gray-400 hover:text-purple-400 hover:bg-gray-800 transition-colors"
                  >
                    <Sparkles size={11} /> Regenerate
                  </button>
                  <button
                    onClick={copyYaml}
                    className="flex items-center gap-1 px-2 py-1 rounded text-[11px] text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-colors"
                  >
                    {copied ? <Check size={11} className="text-green-400" /> : <Copy size={11} />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                  <button
                    onClick={downloadYaml}
                    className="flex items-center gap-1 px-2 py-1 rounded text-[11px] text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-colors"
                  >
                    <Download size={11} /> Download
                  </button>
                </div>
              </div>
              <pre className="p-4 rounded-lg bg-gray-950 border border-gray-800 text-xs font-mono text-gray-200 leading-relaxed whitespace-pre overflow-auto max-h-[55vh]">
                {yaml}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function summarizeRequest(req: RequestConfig, status?: number, body?: string): RequestSummary {
  return {
    name: req.name,
    method: req.method,
    url: req.url,
    headers: req.headers.filter(h => h.enabled && h.key).map(h => ({ key: h.key, value: h.value })),
    params: req.params.filter(p => p.enabled && p.key).map(p => ({ key: p.key, value: p.value })),
    body: req.body?.content || '',
    responseStatus: status,
    responseSample: body,
  };
}
