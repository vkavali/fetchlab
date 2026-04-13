import { useState } from 'react';
import { useApp } from '../store/AppContext';
import { syntaxHighlightJson, formatBytes, formatTime, getStatusClass, generateCodeSnippet, generateId } from '../utils/helpers';
import TestResults from './TestResults';
import ResponseDiff from './ResponseDiff';
import JsonExplorer from './JsonExplorer';
import SchemaValidator from './SchemaValidator';
import ErrorDiagnosis from './ErrorDiagnosis';
import {
  FileJson, Table, Code, Copy, Check, Download,
  Clock, HardDrive, ArrowDown, ChevronDown, FlaskConical, Camera, GitCompare,
  TreePine, Shield, Stethoscope
} from 'lucide-react';

export default function ResponseViewer() {
  const { state, dispatch } = useApp();
  const activeTab = state.tabs.find(t => t.id === state.activeTabId);
  const response = activeTab ? state.responses[activeTab.requestId] : null;
  const request = activeTab ? state.requests[activeTab.requestId] : null;
  const isLoading = activeTab ? state.loading[activeTab.requestId] : false;
  const [activeView, setActiveView] = useState<'body' | 'headers' | 'code' | 'tests' | 'explorer' | 'schema' | 'diagnosis'>('body');
  const [bodyFormat, setBodyFormat] = useState<'pretty' | 'raw' | 'preview'>('pretty');
  const [codeLang, setCodeLang] = useState<'curl' | 'javascript' | 'python' | 'go'>('curl');
  const [copied, setCopied] = useState(false);
  const [showLangDropdown, setShowLangDropdown] = useState(false);
  const [showDiff, setShowDiff] = useState(false);

  const testResults = activeTab ? state.testResults[activeTab.requestId] || [] : [];
  const consoleLogs = activeTab ? state.scriptConsole[activeTab.requestId] || [] : [];
  const hasTests = testResults.length > 0 || consoleLogs.length > 0;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <div className="relative">
          <div className="w-12 h-12 rounded-full border-2 border-gray-800 border-t-brand-500 animate-spin" />
        </div>
        <div className="flex items-center gap-1">
          <div className="loading-dot w-1.5 h-1.5 rounded-full bg-brand-400" />
          <div className="loading-dot w-1.5 h-1.5 rounded-full bg-brand-400" />
          <div className="loading-dot w-1.5 h-1.5 rounded-full bg-brand-400" />
        </div>
        <p className="text-sm text-gray-500">Sending request...</p>
      </div>
    );
  }

  if (!response) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 px-8">
        <div className="w-16 h-16 rounded-2xl bg-gray-800/50 flex items-center justify-center">
          <ArrowDown size={24} className="text-gray-600" />
        </div>
        <p className="text-sm text-gray-500 text-center">
          Enter a URL and hit Send to see the response
        </p>
        <div className="flex items-center gap-4 mt-2 text-[10px] text-gray-700">
          <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 rounded bg-gray-800 border border-gray-700 text-gray-500">Enter</kbd> to send</span>
        </div>
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

  const headerEntries = Object.entries(response.headers);

  return (
    <div className="flex flex-col h-full">
      {/* Status bar */}
      <div className="flex items-center gap-3 px-3 py-2 border-b border-gray-800 bg-gray-900/30">
        {!isError && (
          <>
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-mono text-sm font-bold ${getStatusClass(response.status)} ${
              response.status < 300 ? 'bg-green-500/10' : response.status < 400 ? 'bg-blue-500/10' : response.status < 500 ? 'bg-amber-500/10' : 'bg-red-500/10'
            }`}>
              <div className={`w-2 h-2 rounded-full ${
                response.status < 300 ? 'bg-green-400' : response.status < 400 ? 'bg-blue-400' : response.status < 500 ? 'bg-amber-400' : 'bg-red-400'
              }`} />
              {response.status} {response.statusText}
            </div>
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <Clock size={12} />
              <span className="font-mono">{formatTime(response.time)}</span>
            </div>
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <HardDrive size={12} />
              <span className="font-mono">{formatBytes(response.size)}</span>
            </div>
          </>
        )}
        {isError && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-500/10 text-red-400 text-sm font-medium">
            <div className="w-2 h-2 rounded-full bg-red-400" />
            Request Failed
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
            const blob = new Blob([response.body], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'response.json';
            a.click();
            URL.revokeObjectURL(url);
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
      </div>

      {/* View tabs */}
      <div className="flex items-center gap-0 px-1 border-b border-gray-800 overflow-x-auto scrollbar-hide">
        {[
          { id: 'body' as const, label: 'Body', icon: FileJson },
          { id: 'headers' as const, label: 'Headers', count: headerEntries.length, icon: Table },
          { id: 'explorer' as const, label: 'Explorer', icon: TreePine },
          { id: 'schema' as const, label: 'Schema', icon: Shield },
          { id: 'code' as const, label: 'Code', icon: Code },
          ...(hasTests ? [{ id: 'tests' as const, label: `Tests (${testResults.filter(t=>t.passed).length}/${testResults.length})`, icon: FlaskConical }] : []),
          ...((response && (response.status === 0 || response.status >= 400 || response.time > 3000 || response.size > 1024 * 1024)) ? [{ id: 'diagnosis' as const, label: '🩺 Fix', icon: Stethoscope }] : []),
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
                {codeLang === 'curl' ? 'cURL' : codeLang === 'javascript' ? 'JavaScript' : codeLang === 'python' ? 'Python' : 'Go'}
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
                {generateCodeSnippet(request, codeLang)}
              </pre>
              <button
                onClick={() => copyToClipboard(generateCodeSnippet(request, codeLang))}
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
