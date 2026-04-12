import { useState } from 'react';
import {
  Zap, Send, FolderOpen, Key, Code, GitCompare, FileText, Puzzle,
  ChevronRight, ChevronLeft, Rocket, ArrowRight, Terminal, Globe,
  Link2, FlaskConical, BookOpen, X
} from 'lucide-react';

interface Props {
  onClose: () => void;
}

const STEPS = [
  {
    title: 'Welcome to FetchLab',
    subtitle: 'A modern API client that actually respects developers',
    icon: Zap,
    iconColor: 'from-brand-500 to-accent-500',
    content: (
      <div className="space-y-4">
        <p className="text-sm text-gray-300 leading-relaxed">
          FetchLab is a fast, free, and fully local API testing tool. No accounts, no cloud, no telemetry — your data never leaves your machine.
        </p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: Send, label: 'Send requests', desc: 'GET, POST, PUT, DELETE and more' },
            { icon: Key, label: 'Auto-auth', desc: 'Token profiles fetch & inject tokens' },
            { icon: Code, label: 'Test scripts', desc: 'Write assertions in JavaScript' },
            { icon: GitCompare, label: 'Response diff', desc: 'Compare API responses visually' },
            { icon: FileText, label: 'Generate docs', desc: 'HTML/Markdown from collections' },
            { icon: Puzzle, label: 'Snippets', desc: 'Reusable headers, params, auth' },
          ].map(f => (
            <div key={f.label} className="flex items-start gap-2.5 p-3 rounded-lg bg-gray-800/30 border border-gray-800">
              <f.icon size={16} className="text-brand-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-medium text-gray-200">{f.label}</p>
                <p className="text-[10px] text-gray-500 mt-0.5">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    title: 'Sending Your First Request',
    subtitle: 'Just type a URL and hit Enter',
    icon: Send,
    iconColor: 'from-green-500 to-emerald-500',
    content: (
      <div className="space-y-4">
        <div className="p-4 rounded-xl bg-gray-800/30 border border-gray-800">
          <div className="flex items-center gap-3 mb-3">
            <span className="px-3 py-1.5 rounded-lg bg-green-500/20 text-green-400 font-mono font-bold text-xs">GET</span>
            <code className="text-sm text-gray-300 font-mono">https://jsonplaceholder.typicode.com/users</code>
          </div>
          <p className="text-xs text-gray-500">Try it! Paste this URL into the URL bar and press <kbd className="px-1.5 py-0.5 rounded bg-gray-700 text-gray-300 text-[10px]">Enter</kbd></p>
        </div>
        <div className="space-y-2">
          {[
            { step: '1', text: 'Choose the HTTP method (GET, POST, etc.)' },
            { step: '2', text: 'Enter the URL — supports {{variables}} from environments' },
            { step: '3', text: 'Add params, headers, body, or auth as needed' },
            { step: '4', text: 'Hit Send or press Enter — response appears on the right' },
          ].map(s => (
            <div key={s.step} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-800/30">
              <span className="w-6 h-6 rounded-full bg-brand-500/20 text-brand-400 text-xs font-bold flex items-center justify-center flex-shrink-0">{s.step}</span>
              <p className="text-xs text-gray-400">{s.text}</p>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-gray-600 flex items-center gap-1">
          <Terminal size={10} /> Pro tip: Paste a <strong className="text-gray-400">cURL command</strong> directly into the URL bar — it auto-parses into method, headers, and body!
        </p>
      </div>
    ),
  },
  {
    title: 'Collections & Environments',
    subtitle: 'Organize and reuse your API requests',
    icon: FolderOpen,
    iconColor: 'from-blue-500 to-cyan-500',
    content: (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 rounded-xl bg-gray-800/30 border border-gray-800">
            <FolderOpen size={18} className="text-brand-400 mb-2" />
            <p className="text-xs font-medium text-gray-200 mb-1">Collections</p>
            <ul className="space-y-1">
              <li className="text-[10px] text-gray-500 flex items-center gap-1"><ChevronRight size={8} /> Group related requests</li>
              <li className="text-[10px] text-gray-500 flex items-center gap-1"><ChevronRight size={8} /> Run All to batch-test</li>
              <li className="text-[10px] text-gray-500 flex items-center gap-1"><ChevronRight size={8} /> Export & import as JSON</li>
              <li className="text-[10px] text-gray-500 flex items-center gap-1"><ChevronRight size={8} /> Generate API docs</li>
            </ul>
          </div>
          <div className="p-3 rounded-xl bg-gray-800/30 border border-gray-800">
            <Globe size={18} className="text-green-400 mb-2" />
            <p className="text-xs font-medium text-gray-200 mb-1">Environments</p>
            <ul className="space-y-1">
              <li className="text-[10px] text-gray-500 flex items-center gap-1"><ChevronRight size={8} /> Define variables per env</li>
              <li className="text-[10px] text-gray-500 flex items-center gap-1"><ChevronRight size={8} /> Use {'{{baseUrl}}'} in URLs</li>
              <li className="text-[10px] text-gray-500 flex items-center gap-1"><ChevronRight size={8} /> Switch with one click</li>
              <li className="text-[10px] text-gray-500 flex items-center gap-1"><ChevronRight size={8} /> Dev / Staging / Prod</li>
            </ul>
          </div>
        </div>
      </div>
    ),
  },
  {
    title: 'Auto-Token & Authentication',
    subtitle: 'Never copy-paste a token again',
    icon: Key,
    iconColor: 'from-amber-500 to-orange-500',
    content: (
      <div className="space-y-4">
        <p className="text-sm text-gray-400 leading-relaxed">
          FetchLab supports 6 auth methods. The killer feature is <strong className="text-amber-400">Token Profiles</strong> — configure your token endpoint once, and it auto-fetches & injects tokens into every request.
        </p>
        <div className="space-y-2">
          {[
            { icon: Key, label: 'Bearer Token', desc: 'Paste a static token', color: 'text-gray-400' },
            { icon: Key, label: 'Basic Auth', desc: 'Username + password', color: 'text-gray-400' },
            { icon: Key, label: 'API Key', desc: 'Header or query param', color: 'text-gray-400' },
            { icon: Globe, label: 'OAuth 2.0', desc: 'Client credentials, password, auth code', color: 'text-blue-400' },
            { icon: Link2, label: 'Token Profile ★', desc: 'Auto-fetch from any endpoint, auto-refresh before expiry', color: 'text-amber-400' },
          ].map(a => (
            <div key={a.label} className="flex items-center gap-3 p-2 rounded-lg bg-gray-800/20">
              <a.icon size={14} className={a.color} />
              <div>
                <p className="text-xs font-medium text-gray-300">{a.label}</p>
                <p className="text-[10px] text-gray-600">{a.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    title: 'Scripts, Tests & Chaining',
    subtitle: 'Automate everything',
    icon: FlaskConical,
    iconColor: 'from-purple-500 to-pink-500',
    content: (
      <div className="space-y-4">
        <div className="space-y-3">
          <div className="p-3 rounded-xl bg-gray-800/30 border border-gray-800">
            <p className="text-xs font-medium text-gray-200 mb-1">Pre-request Scripts</p>
            <p className="text-[10px] text-gray-500 mb-2">Run JavaScript before each request to set headers, generate timestamps, sign payloads</p>
            <code className="text-[10px] text-green-400 font-mono block bg-gray-900/50 p-2 rounded">fl.setHeader("X-Timestamp", String(fl.timestamp()));</code>
          </div>
          <div className="p-3 rounded-xl bg-gray-800/30 border border-gray-800">
            <p className="text-xs font-medium text-gray-200 mb-1">Test Scripts</p>
            <p className="text-[10px] text-gray-500 mb-2">Assert on status codes, response body, timing</p>
            <code className="text-[10px] text-blue-400 font-mono block bg-gray-900/50 p-2 rounded">fl.test("Status is 200", () =&gt; {'{'} fl.expect(fl.response.status).toBe(200); {'}'});</code>
          </div>
          <div className="p-3 rounded-xl bg-gray-800/30 border border-gray-800">
            <p className="text-xs font-medium text-gray-200 mb-1">Response Extraction</p>
            <p className="text-[10px] text-gray-500 mb-2">Extract values from responses and chain them into the next request</p>
            <code className="text-[10px] text-amber-400 font-mono block bg-gray-900/50 p-2 rounded">Extract: data.token → {'{{authToken}}'} → used in next request</code>
          </div>
        </div>
      </div>
    ),
  },
  {
    title: 'You\'re Ready!',
    subtitle: 'Start building and testing APIs',
    icon: Rocket,
    iconColor: 'from-brand-500 to-accent-500',
    content: (
      <div className="space-y-4">
        <p className="text-sm text-gray-300 leading-relaxed">
          Everything is saved locally in your browser. Your history, collections, environments, and token configs persist across restarts.
        </p>
        <div className="p-4 rounded-xl bg-brand-500/10 border border-brand-500/20">
          <p className="text-xs font-medium text-brand-400 mb-2">Quick keyboard shortcuts</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              ['Enter', 'Send request'],
              ['Ctrl+N', 'New tab'],
              ['Ctrl+W', 'Close tab'],
              ['Ctrl+L', 'Focus URL bar'],
              ['Ctrl+/', 'Toggle sidebar'],
              ['Ctrl+1-9', 'Switch tab'],
            ].map(([key, desc]) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-[10px] text-gray-500">{desc}</span>
                <kbd className="px-1.5 py-0.5 rounded bg-gray-800 border border-gray-700 text-[9px] text-gray-400 font-mono">{key}</kbd>
              </div>
            ))}
          </div>
        </div>
        <p className="text-xs text-gray-500 text-center">
          Access this guide anytime from the <BookOpen size={10} className="inline" /> help menu in the header
        </p>
      </div>
    ),
  },
];

export default function WelcomeGuide({ onClose }: Props) {
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  const handleDone = () => {
    localStorage.setItem('fetchlab_onboarded', 'true');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-[560px] max-w-[92vw] max-h-[85vh] flex flex-col animate-slide-in overflow-hidden">
        {/* Header */}
        <div className="relative px-6 pt-6 pb-4">
          <button onClick={handleDone} className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-gray-800 text-gray-600 hover:text-gray-300 transition-colors">
            <X size={16} />
          </button>
          <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${current.iconColor} flex items-center justify-center shadow-lg mb-4`}>
            <current.icon size={22} className="text-white" />
          </div>
          <h2 className="text-lg font-bold text-gray-100">{current.title}</h2>
          <p className="text-sm text-gray-500 mt-1">{current.subtitle}</p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 pb-4">
          {current.content}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-800">
          {/* Step dots */}
          <div className="flex items-center gap-1.5">
            {STEPS.map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                className={`w-2 h-2 rounded-full transition-all ${
                  i === step ? 'w-5 bg-brand-500' : i < step ? 'bg-brand-500/40' : 'bg-gray-700'
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {step > 0 && (
              <button
                onClick={() => setStep(step - 1)}
                className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-colors"
              >
                <ChevronLeft size={14} /> Back
              </button>
            )}
            {isLast ? (
              <button
                onClick={handleDone}
                className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-brand-600 text-white text-sm font-semibold hover:bg-brand-500 transition-colors shadow-lg shadow-brand-600/20"
              >
                <Rocket size={14} /> Get Started
              </button>
            ) : (
              <button
                onClick={() => setStep(step + 1)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand-600 text-white text-xs font-semibold hover:bg-brand-500 transition-colors shadow-lg shadow-brand-600/20"
              >
                Next <ArrowRight size={14} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
