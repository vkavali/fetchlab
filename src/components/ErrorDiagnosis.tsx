import type { ResponseData, RequestConfig } from '../types';
import {
  AlertTriangle, ShieldAlert, Clock, Lock, Server,
  FileWarning, Wifi, Ban, ArrowRight, Copy, Check, Sparkles, Loader2
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { aiPost, getAiStatus, type AiDiagnosis } from '../utils/aiClient';

interface Diagnosis {
  title: string;
  icon: typeof AlertTriangle;
  iconColor: string;
  severity: 'critical' | 'warning' | 'info';
  explanation: string;
  fixes: { label: string; code?: string; link?: string }[];
}

function diagnose(request: RequestConfig, response: ResponseData): Diagnosis[] {
  const results: Diagnosis[] = [];
  const { status, body, headers } = response;
  const bodyLower = body.toLowerCase();

  // CORS
  if (status === 0 && (bodyLower.includes('cors') || bodyLower.includes('network') || bodyLower.includes('failed to fetch'))) {
    results.push({
      title: 'CORS Error — Browser Blocked the Request',
      icon: ShieldAlert, iconColor: 'text-red-400', severity: 'critical',
      explanation: 'The server doesn\'t include Access-Control-Allow-Origin headers, so your browser blocks the response. This is a server-side configuration issue, not a bug in your request.',
      fixes: [
        { label: 'Ask your backend team to add CORS headers', code: 'Access-Control-Allow-Origin: *\nAccess-Control-Allow-Methods: GET, POST, PUT, DELETE\nAccess-Control-Allow-Headers: Content-Type, Authorization' },
        { label: 'Use a CORS proxy for testing', code: `https://corsproxy.io/?${encodeURIComponent(request.url)}` },
        { label: 'Test from server-side instead (cURL works because it bypasses CORS)', code: `curl -X ${request.method} '${request.url}'` },
      ],
    });
  }

  // 401 Unauthorized
  if (status === 401) {
    results.push({
      title: '401 Unauthorized — Authentication Failed',
      icon: Lock, iconColor: 'text-amber-400', severity: 'critical',
      explanation: 'The server rejected your credentials. Your token may be expired, missing, or invalid.',
      fixes: [
        { label: 'Check your Authorization header is present and correctly formatted' },
        { label: 'Token may be expired — try refreshing it', code: 'Use a Token Profile in the Auth tab to auto-refresh' },
        { label: 'Verify the token format', code: `Authorization: Bearer <your-token>\n(not: Bearer: <token> or Token <token>)` },
        { label: 'Check if API key is in the right location (header vs query param)' },
      ],
    });
  }

  // 403 Forbidden
  if (status === 403) {
    results.push({
      title: '403 Forbidden — Access Denied',
      icon: Ban, iconColor: 'text-red-400', severity: 'critical',
      explanation: 'You authenticated successfully, but you don\'t have permission to access this resource. This is an authorization issue, not authentication.',
      fixes: [
        { label: 'Check if your user/token has the required role or scope' },
        { label: 'The API may require specific scopes', code: 'scope: read:users write:users admin' },
        { label: 'IP allowlisting may be blocking you — check with your admin' },
      ],
    });
  }

  // 404 Not Found
  if (status === 404) {
    results.push({
      title: '404 Not Found — Endpoint Doesn\'t Exist',
      icon: FileWarning, iconColor: 'text-amber-400', severity: 'warning',
      explanation: 'The URL you\'re requesting doesn\'t match any route on the server.',
      fixes: [
        { label: 'Check for typos in the URL path' },
        { label: 'Verify the API version prefix', code: `/api/v1/users  vs  /api/v2/users` },
        { label: 'The resource ID may not exist — try listing first', code: `GET ${request.url.replace(/\/[^/]+$/, '')}` },
        { label: 'Check trailing slashes — some servers are strict', code: `/api/users  vs  /api/users/` },
      ],
    });
  }

  // 405 Method Not Allowed
  if (status === 405) {
    results.push({
      title: '405 Method Not Allowed',
      icon: Ban, iconColor: 'text-amber-400', severity: 'warning',
      explanation: `The endpoint exists but doesn't accept ${request.method} requests.`,
      fixes: [
        { label: `Try a different method — this endpoint doesn't accept ${request.method}` },
        { label: 'Check the Allow header in the response for supported methods', code: headers['allow'] || 'Check response headers' },
      ],
    });
  }

  // 422 Validation Error
  if (status === 422 || (status === 400 && (bodyLower.includes('validation') || bodyLower.includes('invalid') || bodyLower.includes('required')))) {
    results.push({
      title: `${status} — Request Validation Failed`,
      icon: FileWarning, iconColor: 'text-amber-400', severity: 'warning',
      explanation: 'The server understood your request but the data you sent doesn\'t meet its requirements.',
      fixes: [
        { label: 'Check required fields — the error body usually lists what\'s missing' },
        { label: 'Verify data types (string vs number, array vs object)' },
        { label: 'Check Content-Type header is set', code: 'Content-Type: application/json' },
        { label: 'Validate your JSON body is well-formed — use the Format button in the Body tab' },
      ],
    });
  }

  // 429 Rate Limited
  if (status === 429) {
    const retryAfter = headers['retry-after'];
    results.push({
      title: '429 Too Many Requests — Rate Limited',
      icon: Clock, iconColor: 'text-amber-400', severity: 'warning',
      explanation: `You've sent too many requests in a short period. The server is throttling you.`,
      fixes: [
        { label: retryAfter ? `Wait ${retryAfter} seconds before retrying` : 'Wait a moment before retrying' },
        { label: 'Add delays between requests in the Collection Runner' },
        { label: 'Check if the API has rate limit headers', code: 'X-RateLimit-Remaining, X-RateLimit-Reset' },
      ],
    });
  }

  // 500 Internal Server Error
  if (status >= 500) {
    results.push({
      title: `${status} — Server Error`,
      icon: Server, iconColor: 'text-red-400', severity: 'critical',
      explanation: 'The server crashed while processing your request. This is a backend bug, not something wrong with your request.',
      fixes: [
        { label: 'This is a server-side issue — check backend logs' },
        { label: 'Try the same request with simpler data to narrow down the bug' },
        { label: 'If it\'s intermittent, the server may be overloaded — try again in a moment' },
        { label: 'Report to the backend team with the full request details (use Export)' },
      ],
    });
  }

  // Timeout
  if (status === 0 && bodyLower.includes('timeout')) {
    results.push({
      title: 'Request Timed Out',
      icon: Clock, iconColor: 'text-amber-400', severity: 'warning',
      explanation: 'The server didn\'t respond within the time limit.',
      fixes: [
        { label: 'The server may be slow or down — check its status' },
        { label: 'Try a simpler request (fewer params, smaller body)' },
        { label: 'Check if VPN or firewall is blocking the connection' },
      ],
    });
  }

  // Network error
  if (status === 0 && !bodyLower.includes('cors') && (bodyLower.includes('network') || bodyLower.includes('failed'))) {
    results.push({
      title: 'Network Error — Can\'t Reach Server',
      icon: Wifi, iconColor: 'text-red-400', severity: 'critical',
      explanation: 'The request couldn\'t reach the server at all.',
      fixes: [
        { label: 'Check your internet connection' },
        { label: 'Verify the URL is correct and the server is running' },
        { label: 'DNS may not resolve — try the IP address directly' },
        { label: 'Firewall or VPN may be blocking the connection' },
      ],
    });
  }

  // Slow response
  if (status > 0 && response.time > 3000) {
    results.push({
      title: `Slow Response — ${Math.round(response.time / 1000)}s`,
      icon: Clock, iconColor: 'text-amber-400', severity: 'info',
      explanation: 'The server took a long time to respond. This could indicate performance issues.',
      fixes: [
        { label: 'Check if the endpoint is doing expensive database queries' },
        { label: 'Add pagination to reduce response size', code: '?page=1&limit=20' },
        { label: 'Check if the server is under heavy load' },
      ],
    });
  }

  // Large response
  if (response.size > 1024 * 1024) {
    results.push({
      title: `Large Response — ${(response.size / 1024 / 1024).toFixed(1)}MB`,
      icon: FileWarning, iconColor: 'text-amber-400', severity: 'info',
      explanation: 'This is a very large response. Consider pagination or filtering.',
      fixes: [
        { label: 'Add pagination params', code: '?page=1&limit=50' },
        { label: 'Use field filtering if the API supports it', code: '?fields=id,name,email' },
        { label: 'Consider using a more specific endpoint' },
      ],
    });
  }

  return results;
}

interface Props {
  request: RequestConfig;
  response: ResponseData;
}

export default function ErrorDiagnosis({ request, response }: Props) {
  const [copiedIdx, setCopiedIdx] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<AiDiagnosis | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiEnabled, setAiEnabled] = useState<boolean | null>(null);
  const diagnoses = diagnose(request, response);

  useEffect(() => {
    getAiStatus().then(s => setAiEnabled(s.enabled));
  }, []);

  // Reset AI result when the response changes so we don't show stale advice
  useEffect(() => {
    setAiResult(null);
    setAiError(null);
  }, [response.status, response.body, request.url]);

  const requestAiDiagnosis = async () => {
    setAiLoading(true);
    setAiError(null);
    try {
      const requestHeaders: Record<string, string> = {};
      request.headers.filter(h => h.enabled && h.key).forEach(h => {
        // Redact obvious secrets before sending to the AI endpoint
        const isSensitive = /authorization|api[-_]?key|token|cookie|secret/i.test(h.key);
        requestHeaders[h.key] = isSensitive ? '<redacted>' : h.value;
      });
      const result = await aiPost<AiDiagnosis>('/api/ai/diagnose', {
        method: request.method,
        url: request.url,
        status: response.status,
        statusText: response.statusText,
        time: response.time,
        authType: request.auth?.type || 'none',
        requestHeaders,
        requestBody: request.body?.content || '',
        responseHeaders: response.headers,
        responseBody: response.body,
      });
      setAiResult(result);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'AI diagnosis failed');
    } finally {
      setAiLoading(false);
    }
  };

  if (diagnoses.length === 0 && !aiResult && !aiLoading) {
    // Still show the AI button so users can ask for help on edge cases.
    return (
      <div className="p-3">
        <AiDiagnosisButton onClick={requestAiDiagnosis} loading={false} disabled={aiEnabled === false} />
        {aiEnabled === false && <AiDisabledNotice />}
      </div>
    );
  }

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(id);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  return (
    <div className="space-y-3 p-3 animate-slide-in">
      {/* AI diagnosis controls */}
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Diagnosis</p>
        <AiDiagnosisButton
          onClick={requestAiDiagnosis}
          loading={aiLoading}
          disabled={aiEnabled === false}
        />
      </div>

      {aiEnabled === false && <AiDisabledNotice />}
      {aiError && (
        <div className="flex items-start gap-2 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-300">
          <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" />
          <span>{aiError}</span>
        </div>
      )}

      {aiResult && (
        <AiDiagnosisCard result={aiResult} onCopy={handleCopy} copiedIdx={copiedIdx} />
      )}

      {diagnoses.map((d, i) => (
        <div key={i} className={`rounded-xl border p-4 space-y-3 ${
          d.severity === 'critical' ? 'bg-red-500/5 border-red-500/20' :
          d.severity === 'warning' ? 'bg-amber-500/5 border-amber-500/20' :
          'bg-blue-500/5 border-blue-500/20'
        }`}>
          {/* Title */}
          <div className="flex items-start gap-2.5">
            <d.icon size={18} className={`${d.iconColor} mt-0.5 flex-shrink-0`} />
            <div>
              <p className="text-sm font-semibold text-gray-200">{d.title}</p>
              <p className="text-xs text-gray-400 mt-1 leading-relaxed">{d.explanation}</p>
            </div>
          </div>

          {/* Fixes */}
          <div className="space-y-2 ml-7">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">How to fix</p>
            {d.fixes.map((fix, j) => (
              <div key={j} className="space-y-1">
                <div className="flex items-start gap-2">
                  <ArrowRight size={10} className="text-gray-600 mt-1 flex-shrink-0" />
                  <p className="text-[11px] text-gray-400">{fix.label}</p>
                </div>
                {fix.code && (
                  <div className="ml-4 flex items-start gap-1">
                    <pre className="flex-1 p-2 rounded bg-gray-800/50 border border-gray-800 text-[10px] font-mono text-gray-300 whitespace-pre-wrap break-all">
                      {fix.code}
                    </pre>
                    <button
                      onClick={() => handleCopy(fix.code!, `${i}-${j}`)}
                      className={`p-1 rounded flex-shrink-0 ${copiedIdx === `${i}-${j}` ? 'text-green-400' : 'text-gray-600 hover:text-gray-300'}`}
                    >
                      {copiedIdx === `${i}-${j}` ? <Check size={10} /> : <Copy size={10} />}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function AiDiagnosisButton({ onClick, loading, disabled }: { onClick: () => void; loading: boolean; disabled: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={loading || disabled}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-purple-300 bg-gradient-to-r from-purple-500/15 to-pink-500/15 ring-1 ring-purple-500/30 hover:text-white hover:from-purple-500 hover:to-pink-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
      title={disabled ? 'Set ANTHROPIC_API_KEY on the server to enable' : 'AI diagnosis'}
    >
      {loading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
      {loading ? 'Analyzing…' : 'Ask AI to diagnose'}
    </button>
  );
}

function AiDisabledNotice() {
  return (
    <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300">
      <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" />
      <span>
        AI diagnosis requires <code className="px-1 py-0.5 rounded bg-amber-500/10 font-mono">ANTHROPIC_API_KEY</code> on the server.
      </span>
    </div>
  );
}

function AiDiagnosisCard({
  result,
  onCopy,
  copiedIdx,
}: {
  result: AiDiagnosis;
  onCopy: (text: string, id: string) => void;
  copiedIdx: string | null;
}) {
  const sevClass =
    result.severity === 'critical' ? 'bg-red-500/10 text-red-400 ring-red-500/20'
    : result.severity === 'warning' ? 'bg-amber-500/10 text-amber-400 ring-amber-500/20'
    : 'bg-blue-500/10 text-blue-400 ring-blue-500/20';
  return (
    <div className={`rounded-xl border p-4 space-y-3 bg-purple-500/5 border-purple-500/20`}>
      <div className="flex items-start gap-2.5">
        <Sparkles size={18} className="text-purple-400 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-gray-100">AI diagnosis</p>
            <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-wider ring-1 ${sevClass}`}>
              {result.severity}
            </span>
          </div>
          <p className="text-xs text-gray-300 mt-1.5 leading-relaxed">{result.summary}</p>
          {result.likelyCause && (
            <p className="text-[11px] text-gray-500 mt-1">
              <span className="text-gray-400 font-semibold">Likely cause: </span>{result.likelyCause}
            </p>
          )}
        </div>
      </div>

      {result.fixes && result.fixes.length > 0 && (
        <div className="space-y-2 ml-7">
          <p className="text-[10px] text-purple-400 uppercase tracking-wider font-semibold">Suggested fixes</p>
          {result.fixes.map((fix, j) => (
            <div key={j} className="space-y-1">
              <div className="flex items-start gap-2">
                <ArrowRight size={10} className="text-purple-500/60 mt-1 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-[11px] text-gray-200 font-medium">{fix.title}</p>
                  {fix.detail && <p className="text-[11px] text-gray-400 mt-0.5">{fix.detail}</p>}
                </div>
              </div>
              {fix.code && (
                <div className="ml-4 flex items-start gap-1">
                  <pre className="flex-1 p-2 rounded bg-gray-800/50 border border-gray-800 text-[10px] font-mono text-gray-300 whitespace-pre-wrap break-all">
                    {fix.code}
                  </pre>
                  <button
                    onClick={() => onCopy(fix.code!, `ai-${j}`)}
                    className={`p-1 rounded flex-shrink-0 ${copiedIdx === `ai-${j}` ? 'text-green-400' : 'text-gray-600 hover:text-gray-300'}`}
                  >
                    {copiedIdx === `ai-${j}` ? <Check size={10} /> : <Copy size={10} />}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
