import { useState } from 'react';
import { useApp } from '../store/useApp';
import { syntaxHighlightJson, formatBytes, formatTime, getStatusClass, generateCodeSnippet, generateId } from '../utils/helpers';
import { aiPost } from '../utils/aiClient';
import {
  buildAiReadyJson,
  buildAiReadyMarkdown,
  generateAgentFrameworkSnippet,
  summarizeAiArtifact,
  type AgentFramework,
} from '../utils/aiArtifacts';
import type { RequestConfig, ResponseData } from '../types';
import TestResults from './TestResults';
import ResponseDiff from './ResponseDiff';
import JsonExplorer from './JsonExplorer';
import SchemaValidator from './SchemaValidator';
import ErrorDiagnosis from './ErrorDiagnosis';
import ResponseTimeline from './ResponseTimeline';
import {
  FileJson, Table, Code, Copy, Check, Download,
  Clock, HardDrive, ArrowDown, ChevronDown, FlaskConical, Camera, GitCompare,
  TreePine, Shield, Stethoscope, Timer, Sparkles, Loader2, Bot
} from 'lucide-react';

export default function ResponseViewer() {
  const { state, dispatch } = useApp();
  const activeTab = state.tabs.find(t => t.id === state.activeTabId);
  const response = activeTab ? state.responses[activeTab.requestId] : null;
  const request = activeTab ? state.requests[activeTab.requestId] : null;
  const isLoading = activeTab ? state.loading[activeTab.requestId] : false;
  const [activeView, setActiveView] = useState<'body' | 'headers' | 'code' | 'tests' | 'explorer' | 'schema' | 'diagnosis' | 'timeline' | 'ai'>('body');
  const [bodyFormat, setBodyFormat] = useState<'pretty' | 'raw' | 'preview'>('pretty');
  const [codeLang, setCodeLang] = useState<'curl' | 'javascript' | 'python' | 'go' | AgentFramework>('curl');
  const [aiArtifactFormat, setAiArtifactFormat] = useState<'markdown' | 'json'>('markdown');
  const [copied, setCopied] = useState(false);
  const [showLangDropdown, setShowLangDropdown] = useState(false);
  const [showDiff, setShowDiff] = useState(false);
  const [aiTestStatus, setAiTestStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [aiTestError, setAiTestError] = useState<string | null>(null);

  const testResults = activeTab ? state.testResults[activeTab.requestId] || [] : [];
  const consoleLogs = activeTab ? state.scriptConsole[activeTab.requestId] || [] : [];
  const hasTests = testResults.length > 0 || consoleLogs.length > 0;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-5" style={{ color: 'var(--color-text-muted)' }}>
        <div
          className="animate-spin"
          style={{
            width: 36, height: 36, borderRadius: 999,
            border: '1.5px solid var(--color-border)',
            borderTopColor: 'var(--color-accent)',
          }}
        />
        <p
          className="font-mono"
          style={{
            fontSize: 10.5,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--color-text-subtle)',
          }}
        >
          Agent dispatching request...
        </p>
      </div>
    );
  }

  if (!response) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 px-8">
        <div
          style={{
            width: 44, height: 44, borderRadius: 8,
            background: 'var(--color-surface-2)',
            border: '1px solid var(--color-border-strong)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <ArrowDown size={18} style={{ color: 'var(--color-text-subtle)' }} />
        </div>
        <p
          className="font-mono"
          style={{
            fontSize: 10.5,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--color-text-subtle)',
            textAlign: 'center',
          }}
        >
          No specimen yet
        </p>
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', textAlign: 'center', maxWidth: '32ch' }}>
          Compose a request and press <kbd
            className="font-mono"
            style={{
              padding: '1px 6px',
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border-strong)',
              borderRadius: 3,
              fontSize: 11,
              color: 'var(--color-text)',
              letterSpacing: '0.04em',
            }}
          >Enter</kbd> to fire it.
        </p>
      </div>
    );
  }

  const isError = response.status === 0;
  const isJson = response.contentType.includes('json') || (() => { try { JSON.parse(response.body); return true; } catch { return false; } })();
  const isHtml = response.contentType.includes('html');

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadText = (text: string, filename: string, type = 'text/plain') => {
    const blob = new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const codeSnippetForCurrentLanguage = () => {
    if (!request) return '';
    if (codeLang === 'langchain' || codeLang === 'llamaindex' || codeLang === 'crewai') {
      return generateAgentFrameworkSnippet(request, codeLang);
    }
    return generateCodeSnippet(request, codeLang);
  };

  const handleGenerateTests = async () => {
    if (!request || !response) return;
    setAiTestStatus('loading');
    setAiTestError(null);
    try {
      const result = await aiPost<{ script: string }>('/api/ai/generate-tests', {
        method: request.method,
        url: request.url,
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        time: response.time,
        body: response.body,
      });
      const existing = request.testScript?.trim() || '';
      const merged = existing
        ? `${existing}\n\n// === AI generated tests ===\n${result.script}`
        : result.script;
      dispatch({ type: 'UPDATE_REQUEST', requestId: request.id, updates: { testScript: merged } });
      setAiTestStatus('done');
      setTimeout(() => setAiTestStatus('idle'), 2500);
    } catch (err) {
      setAiTestStatus('error');
      setAiTestError(err instanceof Error ? err.message : 'AI test generation failed');
      setTimeout(() => { setAiTestStatus('idle'); setAiTestError(null); }, 5000);
    }
  };

  const headerEntries = Object.entries(response.headers);

  return (
    <div className="flex flex-col h-full">
      {/* Status bar — instrument readout */}
      <div
        className="flex items-center gap-4 px-3 py-2"
        style={{ background: 'var(--color-surface-2)', borderBottom: '1px solid var(--color-border)' }}
      >
        {!isError && (
          <>
            <div
              className={`flex items-center gap-2 ${getStatusClass(response.status)}`}
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              <span
                style={{
                  width: 7, height: 7, borderRadius: 999,
                  background:
                    response.status < 300 ? 'var(--color-success)' :
                    response.status < 400 ? 'var(--color-text-muted)' :
                    response.status < 500 ? 'var(--color-warning)' :
                    'var(--color-error)',
                  boxShadow: response.status < 300
                    ? '0 0 0 2px color-mix(in oklch, var(--color-success) 18%, transparent)'
                    : 'none',
                }}
              />
              <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: '0.02em' }}>
                {response.status} {response.statusText}
              </span>
            </div>
            <div style={{ width: 1, height: 14, background: 'var(--color-border)' }} />
            <div className="flex items-center gap-1.5" style={{ color: 'var(--color-text-muted)' }}>
              <Clock size={11} />
              <span className="font-mono" style={{ fontSize: 12 }}>{formatTime(response.time)}</span>
            </div>
            <div className="flex items-center gap-1.5" style={{ color: 'var(--color-text-muted)' }}>
              <HardDrive size={11} />
              <span className="font-mono" style={{ fontSize: 12 }}>{formatBytes(response.size)}</span>
            </div>
          </>
        )}
        {isError && (
          <div
            className="flex items-center gap-2"
            style={{ color: 'var(--color-error)' }}
          >
            <span
              style={{
                width: 7, height: 7, borderRadius: 999,
                background: 'var(--color-error)',
                boxShadow: '0 0 0 2px color-mix(in oklch, var(--color-error) 18%, transparent)',
              }}
            />
            <span className="font-mono" style={{ fontSize: 13, fontWeight: 600, letterSpacing: '0.04em' }}>
              Request failed
            </span>
          </div>
        )}

        <div className="flex-1" />

        <button
          onClick={() => copyToClipboard(response.body)}
          className="flex items-center gap-1.5 px-2 py-1 rounded text-xs text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors"
        >
          {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
        <button
          onClick={() => {
            downloadText(response.body, 'response.json');
          }}
          className="p-1 rounded text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors"
        >
          <Download size={14} />
        </button>
        <button
          onClick={() => {
            if (!request || !response) return;
            dispatch({
              type: 'ADD_SNAPSHOT',
              snapshot: {
                id: generateId(),
                name: request.name || request.url,
                requestMethod: request.method,
                requestUrl: request.url,
                response,
                timestamp: Date.now(),
              },
            });
          }}
          className="flex items-center gap-1 px-2 py-1 rounded text-xs text-gray-500 hover:text-amber-400 hover:bg-gray-800 transition-colors"
          title="Save as snapshot"
        >
          <Camera size={12} />
        </button>
        {state.snapshots.length > 0 && (
          <button
            onClick={() => setShowDiff(true)}
            className="flex items-center gap-1 px-2 py-1 rounded text-xs text-gray-500 hover:text-brand-400 hover:bg-gray-800 transition-colors"
            title="Compare with snapshot"
          >
            <GitCompare size={12} />
            Diff
          </button>
        )}
        {!isError && (
          <button
            onClick={handleGenerateTests}
            disabled={aiTestStatus === 'loading'}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-all ${
              aiTestStatus === 'done'
                ? 'text-green-400 bg-green-500/10'
                : aiTestStatus === 'error'
                ? 'text-red-400 bg-red-500/10'
                : 'text-brand-400 bg-brand-500/10 hover:bg-brand-500/20 ring-1 ring-brand-500/20'
            }`}
            title={aiTestError || 'Generate test assertions with AI'}
          >
            {aiTestStatus === 'loading' ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
            {aiTestStatus === 'loading' ? 'Generating...' : aiTestStatus === 'done' ? 'Tests added' : aiTestStatus === 'error' ? 'Failed' : 'Generate Tests'}
          </button>
        )}
      </div>

      {/* View tabs */}
      <div className="flex items-center gap-0 px-1 border-b border-gray-800 overflow-x-auto scrollbar-hide">
        {[
          { id: 'body' as const, label: 'Body', icon: FileJson },
          { id: 'headers' as const, label: 'Headers', count: headerEntries.length, icon: Table },
          { id: 'explorer' as const, label: 'Explorer', icon: TreePine },
          { id: 'schema' as const, label: 'Schema', icon: Shield },
          { id: 'code' as const, label: 'Code', icon: Code },
          { id: 'ai' as const, label: 'AI Artifact', icon: Bot },
          { id: 'timeline' as const, label: 'Timeline', icon: Timer },
          ...(hasTests ? [{ id: 'tests' as const, label: `Tests (${testResults.filter(t=>t.passed).length}/${testResults.length})`, icon: FlaskConical }] : []),
          ...((response && (response.status === 0 || response.status >= 400 || response.time > 3000 || response.size > 1024 * 1024)) ? [{ id: 'diagnosis' as const, label: 'Fix', icon: Stethoscope }] : []),
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveView(tab.id)}
            className={`flex items-center gap-1 px-2 py-2 text-[11px] font-medium border-b-2 transition-colors flex-shrink-0 ${
              activeView === tab.id
                ? 'border-brand-400 text-brand-400'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            <tab.icon size={11} />
            {tab.label}
            {tab.count !== undefined && (
              <span className="px-1 py-0 rounded text-[9px] bg-gray-800 text-gray-500">{tab.count}</span>
            )}
          </button>
        ))}

        {activeView === 'body' && !isError && (
          <div className="ml-auto flex gap-0.5 bg-gray-800/50 rounded-md p-0.5">
            {[
              { id: 'pretty' as const, label: 'Pretty' },
              { id: 'raw' as const, label: 'Raw' },
              ...(isHtml ? [{ id: 'preview' as const, label: 'Preview' }] : []),
            ].map(fmt => (
              <button
                key={fmt.id}
                onClick={() => setBodyFormat(fmt.id)}
                className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                  bodyFormat === fmt.id
                    ? 'bg-gray-700 text-gray-200'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {fmt.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {activeView === 'body' && (
          <div className="p-3">
            {isError ? (
              <pre className="text-sm text-red-400 whitespace-pre-wrap font-mono leading-relaxed">{response.body}</pre>
            ) : bodyFormat === 'pretty' && isJson ? (
              <pre
                className="text-xs font-mono leading-relaxed"
                dangerouslySetInnerHTML={{ __html: syntaxHighlightJson(response.body) }}
              />
            ) : bodyFormat === 'preview' && isHtml ? (
              <iframe
                srcDoc={response.body}
                className="w-full h-[500px] bg-white rounded-lg"
                sandbox="allow-scripts"
                title="HTML Preview"
              />
            ) : (
              <pre className="text-xs text-gray-300 font-mono whitespace-pre-wrap leading-relaxed break-all">{response.body}</pre>
            )}
          </div>
        )}

        {activeView === 'headers' && (
          <div className="p-3">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-gray-600 uppercase tracking-wider">
                  <th className="pb-2 font-semibold">Name</th>
                  <th className="pb-2 font-semibold">Value</th>
                </tr>
              </thead>
              <tbody>
                {headerEntries.map(([key, value]) => (
                  <tr key={key} className="border-t border-gray-800/50 group hover:bg-gray-800/20">
                    <td className="py-2 pr-4 font-mono text-brand-300 font-medium">{key}</td>
                    <td className="py-2 font-mono text-gray-400 break-all">
                      {value}
                      <button
                        onClick={() => copyToClipboard(value)}
                        className="ml-2 p-0.5 rounded opacity-0 group-hover:opacity-100 text-gray-600 hover:text-gray-300 transition-all inline-flex"
                      >
                        <Copy size={10} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeView === 'code' && request && (
          <div className="p-3 space-y-3">
            <div className="relative">
              <button
                onClick={() => setShowLangDropdown(!showLangDropdown)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-xs text-gray-300 hover:border-gray-600 transition-colors"
              >
                {{
                  curl: 'cURL',
                  javascript: 'JavaScript',
                  python: 'Python',
                  go: 'Go',
                  langchain: 'LangChain Tool',
                  llamaindex: 'LlamaIndex Tool',
                  crewai: 'CrewAI Tool',
                }[codeLang]}
                <ChevronDown size={12} className="text-gray-500" />
              </button>
              {showLangDropdown && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowLangDropdown(false)} />
                  <div className="absolute top-full left-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-20 py-1 min-w-[140px] animate-slide-in">
                    {[
                      { id: 'curl' as const, label: 'cURL' },
                      { id: 'javascript' as const, label: 'JavaScript' },
                      { id: 'python' as const, label: 'Python' },
                      { id: 'go' as const, label: 'Go' },
                      { id: 'langchain' as const, label: 'LangChain Tool' },
                      { id: 'llamaindex' as const, label: 'LlamaIndex Tool' },
                      { id: 'crewai' as const, label: 'CrewAI Tool' },
                    ].map(lang => (
                      <button
                        key={lang.id}
                        onClick={() => { setCodeLang(lang.id); setShowLangDropdown(false); }}
                        className={`w-full px-3 py-1.5 text-left text-xs hover:bg-gray-700/50 transition-colors ${
                          codeLang === lang.id ? 'text-brand-400' : 'text-gray-300'
                        }`}
                      >
                        {lang.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            <div className="relative group">
              <pre className="p-4 rounded-lg bg-gray-800/50 border border-gray-800 text-xs font-mono text-gray-300 whitespace-pre-wrap leading-relaxed overflow-x-auto">
                {codeSnippetForCurrentLanguage()}
              </pre>
              <button
                onClick={() => copyToClipboard(codeSnippetForCurrentLanguage())}
                className="absolute top-2 right-2 p-1.5 rounded bg-gray-700/50 text-gray-500 hover:text-gray-200 opacity-0 group-hover:opacity-100 transition-all"
              >
                <Copy size={12} />
              </button>
            </div>
          </div>
        )}

        {activeView === 'explorer' && response && (
          <JsonExplorer data={response.body} />
        )}

        {activeView === 'schema' && response && (
          <SchemaValidator responseBody={response.body} />
        )}

        {activeView === 'tests' && (
          <TestResults tests={testResults} consoleLogs={consoleLogs} />
        )}

        {activeView === 'timeline' && response && (
          <ResponseTimeline response={response} />
        )}

        {activeView === 'ai' && response && request && (
          <AiArtifactPanel
            request={request}
            response={response}
            format={aiArtifactFormat}
            onFormatChange={setAiArtifactFormat}
            onCopy={copyToClipboard}
            onDownload={downloadText}
          />
        )}

        {activeView === 'diagnosis' && response && request && (
          <ErrorDiagnosis request={request} response={response} />
        )}
      </div>

      {/* Diff modal */}
      {showDiff && response && (
        <ResponseDiff currentResponse={response} onClose={() => setShowDiff(false)} />
      )}
    </div>
  );
}

function AiArtifactPanel({
  request,
  response,
  format,
  onFormatChange,
  onCopy,
  onDownload,
}: {
  request: RequestConfig;
  response: ResponseData;
  format: 'markdown' | 'json';
  onFormatChange: (format: 'markdown' | 'json') => void;
  onCopy: (text: string) => void;
  onDownload: (text: string, filename: string, type?: string) => void;
}) {
  const markdown = buildAiReadyMarkdown(request, response);
  const json = JSON.stringify(buildAiReadyJson(request, response), null, 2);
  const content = format === 'markdown' ? markdown : json;
  const summary = summarizeAiArtifact(content);
  const filename = format === 'markdown' ? 'fetchlab-ai-artifact.md' : 'fetchlab-ai-artifact.json';

  return (
    <div className="p-4 space-y-4">
      <div
        className="grid md:grid-cols-3 gap-px"
        style={{ border: '1px solid var(--color-border)', background: 'var(--color-border)' }}
      >
        {[
          ['Estimated input', `${summary.tokens.toLocaleString()} tokens`],
          ['Estimated cost', `$${summary.costUsd.toFixed(5)}`],
          ['Characters', summary.characters.toLocaleString()],
        ].map(([label, value]) => (
          <div key={label} className="p-3" style={{ background: 'var(--color-surface)' }}>
            <div className="font-mono uppercase" style={{ fontSize: 9.5, letterSpacing: '0.14em', color: 'var(--color-text-subtle)', marginBottom: 6 }}>
              {label}
            </div>
            <div className="font-mono" style={{ color: 'var(--color-text)', fontSize: 13 }}>{value}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1 p-0.5 rounded" style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}>
          {[
            { id: 'markdown' as const, label: 'Markdown' },
            { id: 'json' as const, label: 'Structured JSON' },
          ].map(item => (
            <button
              key={item.id}
              onClick={() => onFormatChange(item.id)}
              className="px-2.5 py-1 rounded text-[11px] font-medium"
              style={{
                background: format === item.id ? 'var(--color-accent)' : 'transparent',
                color: format === item.id ? 'var(--color-accent-ink)' : 'var(--color-text-muted)',
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => onCopy(content)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs"
            style={{ color: 'var(--color-text)', border: '1px solid var(--color-border-strong)' }}
          >
            <Copy size={12} />
            Copy
          </button>
          <button
            onClick={() => onDownload(content, filename, format === 'json' ? 'application/json' : 'text/markdown')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs"
            style={{ background: 'var(--color-accent)', color: 'var(--color-accent-ink)' }}
          >
            <Download size={12} />
            Download
          </button>
        </div>
      </div>

      <div
        className="p-3 rounded text-[11px]"
        style={{ background: 'var(--color-warning-soft)', border: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}
      >
        Cost is an estimate using 4 characters per token and $3 per 1M input tokens. Provider billing varies by model.
      </div>

      <pre className="p-4 rounded-lg bg-gray-800/50 border border-gray-800 text-xs font-mono text-gray-300 whitespace-pre-wrap leading-relaxed overflow-x-auto max-h-[460px]">
        {content}
      </pre>
    </div>
  );
}
