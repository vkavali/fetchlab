import type { ResponseData, RequestConfig } from '../types';
import {
  AlertTriangle, ShieldAlert, Clock, Lock, Server,
  FileWarning, Wifi, Ban, ArrowRight, Copy, Check
} from 'lucide-react';
import { useState } from 'react';

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
  const diagnoses = diagnose(request, response);

  if (diagnoses.length === 0) return null;

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(id);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  return (
    <div className="space-y-3 p-3 animate-slide-in">
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
