import { useState } from 'react';
import { useApp } from '../store/AppContext';
import {
  X, MessageSquare, Hash, Webhook, Code, Copy, Check,
  ExternalLink, Play, CheckCircle2, XCircle, Globe
} from 'lucide-react';

interface Props {
  onClose: () => void;
}

export default function Integrations({ onClose }: Props) {
  const { state } = useApp();
  const [activeTab, setActiveTab] = useState<'slack' | 'teams' | 'widget'>('slack');
  const [copied, setCopied] = useState<string | null>(null);
  const [teamsWebhookUrl, setTeamsWebhookUrl] = useState('');
  const [teamsTestUrl, setTeamsTestUrl] = useState('https://jsonplaceholder.typicode.com/users/1');
  const [teamsTestMethod, setTeamsTestMethod] = useState('GET');
  const [teamsStatus, setTeamsStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');

  const baseUrl = window.location.origin;
  const slackRequestUrl = `${baseUrl}/api/slack`;

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleTeamsTest = async () => {
    if (!teamsWebhookUrl || !teamsTestUrl) return;
    setTeamsStatus('sending');
    try {
      const res = await fetch(`${baseUrl}/api/teams/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method: teamsTestMethod, url: teamsTestUrl, webhookUrl: teamsWebhookUrl }),
      });
      if (res.ok) setTeamsStatus('success');
      else setTeamsStatus('error');
    } catch {
      setTeamsStatus('error');
    }
    setTimeout(() => setTeamsStatus('idle'), 3000);
  };

  // Generate widget URLs for all collection requests
  const widgetRequests = state.collections.flatMap(c => c.requests.map(r => ({
    name: r.name, method: r.method, url: r.url, collection: c.name,
    widgetUrl: `${baseUrl}/api/widget?method=${r.method}&url=${encodeURIComponent(r.url)}&title=${encodeURIComponent(r.name)}`,
    iframe: `<iframe src="${baseUrl}/api/widget?method=${r.method}&url=${encodeURIComponent(r.url)}&title=${encodeURIComponent(r.name)}" width="600" height="400" frameborder="0"></iframe>`,
  })));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-[650px] max-w-[92vw] max-h-[85vh] flex flex-col animate-slide-in" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <Webhook size={16} className="text-brand-400" />
            <h2 className="text-sm font-semibold text-gray-200">Integrations</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-500 hover:text-gray-300"><X size={16} /></button>
        </div>

        <p className="px-5 py-2 text-xs text-gray-500 border-b border-gray-800">
          Test APIs from Slack, Teams, or embed live demos — without opening FetchLab
        </p>

        {/* Tabs */}
        <div className="flex border-b border-gray-800">
          {[
            { id: 'slack' as const, label: 'Slack Bot', icon: Hash },
            { id: 'teams' as const, label: 'Teams', icon: MessageSquare },
            { id: 'widget' as const, label: 'Embed Widget', icon: Code },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors ${
                activeTab === tab.id ? 'text-brand-400 border-b-2 border-brand-400' : 'text-gray-500 hover:text-gray-300'
              }`}>
              <tab.icon size={13} />{tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {/* SLACK */}
          {activeTab === 'slack' && (
            <div className="space-y-4">
              <p className="text-xs text-gray-400 leading-relaxed">
                Add a <code className="text-gray-300 bg-gray-800 px-1 rounded">/fetchlab</code> slash command to your Slack workspace.
                Any team member can test APIs directly in a channel.
              </p>

              <div className="p-4 rounded-xl bg-gray-800/30 border border-gray-800">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-3">Setup Steps</p>
                <div className="space-y-3">
                  {[
                    { step: '1', title: 'Create a Slack App', desc: 'Go to api.slack.com/apps → Create New App → From Scratch' },
                    { step: '2', title: 'Add Slash Command', desc: 'Features → Slash Commands → Create: /fetchlab' },
                    { step: '3', title: 'Set Request URL', desc: 'Paste the URL below as the Request URL' },
                    { step: '4', title: 'Install to Workspace', desc: 'Install App → authorize → done!' },
                  ].map(s => (
                    <div key={s.step} className="flex items-start gap-3">
                      <span className="w-6 h-6 rounded-full bg-brand-500/20 text-brand-400 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{s.step}</span>
                      <div>
                        <p className="text-xs font-medium text-gray-200">{s.title}</p>
                        <p className="text-[10px] text-gray-500">{s.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Request URL (paste in Slack)</label>
                <div className="flex items-center gap-2 mt-1">
                  <code className="flex-1 p-2.5 rounded-lg bg-gray-800/50 border border-gray-800 text-xs text-gray-300 font-mono select-all break-all">
                    {slackRequestUrl}
                  </code>
                  <button onClick={() => handleCopy(slackRequestUrl, 'slack-url')}
                    className={`p-2 rounded-lg flex-shrink-0 transition-colors ${copied === 'slack-url' ? 'bg-green-500/20 text-green-400' : 'bg-gray-800 text-gray-400 hover:text-gray-200'}`}>
                    {copied === 'slack-url' ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-gray-800/20 border border-gray-800">
                <p className="text-[10px] text-gray-500 font-semibold mb-2">Usage in Slack</p>
                <div className="space-y-1 font-mono text-[11px]">
                  <p className="text-green-400">/fetchlab GET https://api.example.com/users</p>
                  <p className="text-blue-400">/fetchlab POST https://api.example.com/users {"{"}"name":"John"{"}"}</p>
                  <p className="text-amber-400">/fetchlab DELETE https://api.example.com/users/1</p>
                </div>
              </div>
            </div>
          )}

          {/* TEAMS */}
          {activeTab === 'teams' && (
            <div className="space-y-4">
              <p className="text-xs text-gray-400 leading-relaxed">
                Send API test results to a Microsoft Teams channel via incoming webhook.
              </p>

              <div className="p-4 rounded-xl bg-gray-800/30 border border-gray-800">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-3">Setup</p>
                <div className="space-y-2">
                  {[
                    'In Teams: channel → ••• → Connectors → Incoming Webhook',
                    'Name it "FetchLab" → Create → Copy the webhook URL',
                    'Paste it below and click Test',
                  ].map((s, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-accent-500/20 text-accent-400 text-[9px] font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                      <span className="text-[11px] text-gray-400">{s}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Teams Webhook URL</label>
                <input value={teamsWebhookUrl} onChange={e => setTeamsWebhookUrl(e.target.value)}
                  placeholder="https://outlook.office.com/webhook/..."
                  className="mt-1 w-full bg-gray-800/50 border border-gray-800 rounded-lg px-3 py-2 text-xs text-gray-200 font-mono focus:outline-none focus:border-brand-500/50" />
              </div>

              <div className="flex gap-2">
                <select value={teamsTestMethod} onChange={e => setTeamsTestMethod(e.target.value)}
                  className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-2 text-xs text-gray-300">
                  <option>GET</option><option>POST</option><option>PUT</option><option>DELETE</option>
                </select>
                <input value={teamsTestUrl} onChange={e => setTeamsTestUrl(e.target.value)}
                  className="flex-1 bg-gray-800/50 border border-gray-800 rounded-lg px-3 py-2 text-xs text-gray-200 font-mono focus:outline-none focus:border-brand-500/50" />
                <button onClick={handleTeamsTest} disabled={!teamsWebhookUrl || teamsStatus === 'sending'}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand-600 text-white text-xs font-medium hover:bg-brand-500 disabled:opacity-50">
                  {teamsStatus === 'sending' ? '⏳' : teamsStatus === 'success' ? <CheckCircle2 size={14} /> : teamsStatus === 'error' ? <XCircle size={14} /> : <Play size={14} />}
                  Test
                </button>
              </div>
            </div>
          )}

          {/* EMBED WIDGET */}
          {activeTab === 'widget' && (
            <div className="space-y-4">
              <p className="text-xs text-gray-400 leading-relaxed">
                Embed a live API tester in any webpage, wiki, or internal dashboard.
                Teams can run API demos without installing anything.
              </p>

              {widgetRequests.length === 0 ? (
                <div className="text-center py-6 text-gray-600">
                  <Globe size={24} className="mx-auto mb-2" />
                  <p className="text-xs">Add requests to your collections first</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {widgetRequests.map((wr, i) => (
                    <div key={i} className="p-3 rounded-lg border border-gray-800 bg-gray-800/20 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className={`font-mono font-bold text-[10px] method-${wr.method.toLowerCase()}`}>{wr.method}</span>
                        <span className="text-xs text-gray-300 flex-1 truncate">{wr.name}</span>
                        <a href={wr.widgetUrl} target="_blank" rel="noopener noreferrer"
                          className="text-[10px] text-brand-400 hover:text-brand-300 flex items-center gap-0.5">
                          Preview <ExternalLink size={9} />
                        </a>
                      </div>

                      <div className="flex gap-1">
                        <button onClick={() => handleCopy(wr.iframe, `iframe-${i}`)}
                          className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-colors ${
                            copied === `iframe-${i}` ? 'bg-green-500/20 text-green-400' : 'bg-gray-800 text-gray-400 hover:text-gray-200'
                          }`}>
                          {copied === `iframe-${i}` ? <><Check size={10} /> Copied</> : <><Copy size={10} /> Copy iframe</>}
                        </button>
                        <button onClick={() => handleCopy(wr.widgetUrl, `url-${i}`)}
                          className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-colors ${
                            copied === `url-${i}` ? 'bg-green-500/20 text-green-400' : 'bg-gray-800 text-gray-400 hover:text-gray-200'
                          }`}>
                          {copied === `url-${i}` ? <><Check size={10} /> Copied</> : <><Copy size={10} /> Copy URL</>}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="p-3 rounded-lg bg-brand-500/5 border border-brand-500/10">
                <p className="text-[10px] text-brand-400/70">
                  Embed the iframe in Notion, Confluence, GitHub Pages, or any internal dashboard.
                  Anyone can click "Run" to test the API live — no FetchLab install needed.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
