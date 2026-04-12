import { useState } from 'react';
import {
  X, BookOpen, MessageCircleQuestion, Keyboard, Zap, ExternalLink,
  ChevronDown, ChevronRight
} from 'lucide-react';

interface Props {
  onClose: () => void;
  onShowGuide: () => void;
}

const FAQ_ITEMS = [
  {
    q: 'Where is my data stored?',
    a: 'Everything is stored locally in your browser\'s localStorage. No data ever leaves your machine. No accounts, no cloud, no telemetry.',
  },
  {
    q: 'How do I import a cURL command?',
    a: 'Just paste a cURL command directly into the URL bar. FetchLab auto-detects it and parses the method, headers, body, and URL.',
  },
  {
    q: 'How do I auto-fetch tokens?',
    a: 'Go to the Tokens tab in the sidebar → Create a Token Profile → set your token endpoint, credentials, and extraction path. Then in any request\'s Auth tab, select "Token Profile" and pick your profile. Tokens auto-fetch and refresh.',
  },
  {
    q: 'How do I chain requests?',
    a: 'In the "Extract" tab of a request, add an extraction rule (e.g., variable "authToken" from path "data.token"). After sending, the value is saved. Use {{authToken}} in any other request.',
  },
  {
    q: 'How do I write test scripts?',
    a: 'Go to the Scripts tab in any request. Use fl.test("name", () => { fl.expect(fl.response.status).toBe(200); }) to write assertions. Tests run automatically when you send the request.',
  },
  {
    q: 'How do I generate API docs?',
    a: 'Expand a collection in the sidebar → click "Docs". Choose HTML or Markdown format, customize options, and download. The HTML file is self-contained with no external dependencies.',
  },
  {
    q: 'How do I compare API responses?',
    a: 'After getting a response, click the camera icon (📷) in the response panel to save a snapshot. Next time you get a response, click "Diff" to compare against the snapshot.',
  },
  {
    q: 'How do I use environment variables?',
    a: 'Go to the Env tab in the sidebar → create variables like baseUrl=https://api.example.com. Use {{baseUrl}} in any URL, header, or body field. Switch environments with one click.',
  },
  {
    q: 'Can I export/share collections?',
    a: 'Yes! Click "Export" under any collection → choose format (JSON, cURL, JavaScript, Python, Go, or Plain Text) → download or copy to clipboard.',
  },
  {
    q: 'What are snippets?',
    a: 'Reusable templates for headers, params, or auth configs. Go to the Snippets tab → create a snippet → apply it to any request with one click. Great for standard headers you use everywhere.',
  },
  {
    q: 'Is this free?',
    a: 'Yes, completely free and open source. No paid tiers, no feature gates, no limits.',
  },
];

export default function HelpMenu({ onClose, onShowGuide }: Props) {
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'faq' | 'shortcuts' | 'about'>('faq');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-[550px] max-w-[92vw] max-h-[80vh] flex flex-col animate-slide-in" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <BookOpen size={16} className="text-brand-400" />
            <h2 className="text-sm font-semibold text-gray-200">Help & Guide</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-500 hover:text-gray-300"><X size={16} /></button>
        </div>

        {/* Quick action */}
        <div className="px-5 py-3 border-b border-gray-800">
          <button
            onClick={onShowGuide}
            className="w-full flex items-center gap-3 p-3 rounded-xl bg-brand-500/10 border border-brand-500/20 hover:bg-brand-500/15 transition-colors group"
          >
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-brand-500 to-accent-500 flex items-center justify-center flex-shrink-0">
              <Zap size={18} className="text-white" />
            </div>
            <div className="text-left flex-1">
              <p className="text-sm font-medium text-brand-400">Interactive Guide</p>
              <p className="text-[10px] text-gray-500">Step-by-step walkthrough of all features</p>
            </div>
            <ExternalLink size={14} className="text-gray-600 group-hover:text-brand-400 transition-colors" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-800">
          {[
            { id: 'faq' as const, label: 'FAQ', icon: MessageCircleQuestion },
            { id: 'shortcuts' as const, label: 'Shortcuts', icon: Keyboard },
            { id: 'about' as const, label: 'About', icon: Zap },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors ${
                activeTab === tab.id
                  ? 'text-brand-400 border-b-2 border-brand-400'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <tab.icon size={13} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'faq' && (
            <div className="p-3">
              {FAQ_ITEMS.map((item, i) => (
                <div key={i} className="border-b border-gray-800/50 last:border-0">
                  <button
                    onClick={() => setExpandedFaq(expandedFaq === i ? null : i)}
                    className="flex items-start gap-2 w-full px-3 py-3 text-left hover:bg-gray-800/30 rounded transition-colors"
                  >
                    {expandedFaq === i ? <ChevronDown size={14} className="text-brand-400 mt-0.5 flex-shrink-0" /> : <ChevronRight size={14} className="text-gray-600 mt-0.5 flex-shrink-0" />}
                    <span className={`text-xs ${expandedFaq === i ? 'text-gray-200 font-medium' : 'text-gray-400'}`}>{item.q}</span>
                  </button>
                  {expandedFaq === i && (
                    <div className="px-9 pb-3 animate-slide-in">
                      <p className="text-xs text-gray-500 leading-relaxed">{item.a}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {activeTab === 'shortcuts' && (
            <div className="p-5 space-y-4">
              {[
                { section: 'Request', shortcuts: [
                  ['Enter', 'Send current request'],
                  ['Ctrl + L', 'Focus URL bar'],
                ] },
                { section: 'Tabs', shortcuts: [
                  ['Ctrl + N', 'New tab'],
                  ['Ctrl + W', 'Close current tab'],
                  ['Ctrl + 1-9', 'Switch to tab by number'],
                ] },
                { section: 'Navigation', shortcuts: [
                  ['Ctrl + /', 'Toggle sidebar'],
                ] },
              ].map(group => (
                <div key={group.section}>
                  <p className="text-[10px] text-gray-600 uppercase tracking-wider font-semibold mb-2">{group.section}</p>
                  <div className="space-y-1">
                    {group.shortcuts.map(([key, desc]) => (
                      <div key={key} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-gray-800/30">
                        <span className="text-xs text-gray-400">{desc}</span>
                        <kbd className="px-2 py-0.5 rounded bg-gray-800 border border-gray-700 text-[10px] text-gray-300 font-mono">{key}</kbd>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'about' && (
            <div className="p-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-500 to-accent-500 flex items-center justify-center shadow-lg">
                  <Zap size={22} className="text-white" />
                </div>
                <div>
                  <h3 className="text-base font-bold bg-gradient-to-r from-brand-400 to-accent-400 bg-clip-text text-transparent">FetchLab</h3>
                  <p className="text-xs text-gray-500">Version 1.0.0</p>
                </div>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed">
                A modern, open-source API client built for developers who want speed, privacy, and powerful features without the bloat.
              </p>
              <div className="p-3 rounded-lg bg-gray-800/30 border border-gray-800 space-y-2">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Built with</p>
                <div className="flex flex-wrap gap-2">
                  {['React', 'TypeScript', 'Tailwind CSS', 'Vite', 'Lucide Icons'].map(t => (
                    <span key={t} className="px-2 py-0.5 rounded text-[10px] bg-gray-800 text-gray-400">{t}</span>
                  ))}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-green-500/5 border border-green-500/20">
                <p className="text-xs text-green-400 font-medium">100% Local & Private</p>
                <p className="text-[10px] text-gray-500 mt-1">No accounts. No cloud. No telemetry. Your data stays on your machine in localStorage.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
