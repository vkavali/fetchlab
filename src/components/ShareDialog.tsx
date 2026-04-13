import { useState } from 'react';
import { useApp } from '../store/AppContext';
import type { Collection } from '../types';
import { generateTeamSyncFile } from '../utils/shareLink';
import { collectionToShareableJson } from '../utils/helpers';
import {
  X, Copy, Check, Download, Users, GitBranch,
  FolderOpen, Send
} from 'lucide-react';

interface Props {
  collection: Collection;
  onClose: () => void;
}

export default function ShareDialog({ collection, onClose }: Props) {
  const { state } = useApp();
  const [copied, setCopied] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'link' | 'team'>('link');

  const shareJson = JSON.stringify(collectionToShareableJson(collection), null, 2);

  const handleCopyJson = () => {
    navigator.clipboard.writeText(shareJson);
    setCopied('json');
    setTimeout(() => setCopied(null), 3000);
  };

  const handleDownloadTeamFile = () => {
    const content = generateTeamSyncFile([collection]);
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${collection.name.replace(/\s+/g, '-').toLowerCase()}.fetchlab.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadAllTeamFile = () => {
    const content = generateTeamSyncFile(state.collections);
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'fetchlab-workspace.fetchlab.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-[520px] max-w-[92vw] max-h-[80vh] flex flex-col animate-slide-in" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-brand-400" />
            <h2 className="text-sm font-semibold text-gray-200">Share with Team</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-500 hover:text-gray-300"><X size={16} /></button>
        </div>

        {/* Collection info */}
        <div className="px-5 py-2 border-b border-gray-800 flex items-center gap-2">
          <FolderOpen size={14} className="text-brand-400/70" />
          <span className="text-sm text-gray-300">{collection.name}</span>
          <span className="text-[10px] text-gray-600">{collection.requests.length} requests</span>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-800">
          {[
            { id: 'link' as const, label: 'Copy & Paste', icon: Copy },
            { id: 'team' as const, label: 'Git Sync File', icon: GitBranch },
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
        <div className="flex-1 overflow-y-auto p-5">
          {activeTab === 'link' && (
            <div className="space-y-4">
              <p className="text-xs text-gray-400 leading-relaxed">
                Copy this collection as JSON. Paste it in Slack, Teams, or email. Your teammate clicks <strong className="text-gray-300">Import</strong> in their FetchLab sidebar and pastes it in.
              </p>

              {/* JSON preview */}
              <pre className="p-3 rounded-lg bg-gray-800/50 border border-gray-800 text-[10px] text-gray-500 font-mono leading-relaxed max-h-[180px] overflow-auto whitespace-pre-wrap select-all">
                {shareJson}
              </pre>

              {/* Copy button */}
              <button
                onClick={handleCopyJson}
                className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-semibold transition-colors ${
                  copied === 'json'
                    ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                    : 'bg-brand-600 text-white hover:bg-brand-500 shadow-lg shadow-brand-600/20'
                }`}
              >
                {copied === 'json' ? <><Check size={16} /> Copied to Clipboard!</> : <><Copy size={16} /> Copy Collection JSON</>}
              </button>

              <div className="p-3 rounded-lg bg-gray-800/20 border border-gray-800/50 space-y-2">
                <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">How your teammate imports</p>
                <div className="space-y-1.5">
                  {[
                    { step: '1', icon: Copy, text: 'You copy the JSON above and send it' },
                    { step: '2', icon: Send, text: 'Teammate pastes it into a .json file' },
                    { step: '3', icon: FolderOpen, text: 'Clicks Import in FetchLab sidebar → selects the file' },
                  ].map(s => (
                    <div key={s.step} className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-brand-500/20 text-brand-400 text-[9px] font-bold flex items-center justify-center flex-shrink-0">{s.step}</span>
                      <s.icon size={11} className="text-gray-600 flex-shrink-0" />
                      <span className="text-[11px] text-gray-500">{s.text}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 p-2 rounded-lg bg-green-500/5 border border-green-500/10">
                <span className="text-[10px] text-green-500/70">🔒 Auth secrets are excluded — safe to share</span>
              </div>
            </div>
          )}

          {activeTab === 'team' && (
            <div className="space-y-4">
              <p className="text-xs text-gray-400 leading-relaxed">
                Export a <code className="text-gray-300 bg-gray-800 px-1 rounded">.fetchlab.json</code> file to commit to your git repo. Team members import it to stay in sync. Every update = a new commit.
              </p>

              <div className="p-3 rounded-lg bg-gray-800/20 border border-gray-800/50 space-y-2">
                <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">Workflow</p>
                <div className="space-y-1.5">
                  {[
                    { step: '1', text: 'Download the .fetchlab.json file' },
                    { step: '2', text: 'Commit to your repo (e.g. /api-tests/collection.fetchlab.json)' },
                    { step: '3', text: 'Team members pull and import into FetchLab' },
                    { step: '4', text: 'Update the file when APIs change → commit → team pulls' },
                  ].map(s => (
                    <div key={s.step} className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-accent-500/20 text-accent-400 text-[9px] font-bold flex items-center justify-center flex-shrink-0">{s.step}</span>
                      <span className="text-[11px] text-gray-500">{s.text}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <button
                  onClick={handleDownloadTeamFile}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-brand-600 text-white text-sm font-semibold hover:bg-brand-500 transition-colors shadow-lg shadow-brand-600/20"
                >
                  <Download size={16} />
                  Download {collection.name}.fetchlab.json
                </button>
                <button
                  onClick={handleDownloadAllTeamFile}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-gray-800 text-gray-300 text-xs font-medium hover:bg-gray-700 transition-colors border border-gray-700"
                >
                  <Download size={14} />
                  Download ALL collections as one file
                </button>
              </div>

              <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-500/5 border border-amber-500/10">
                <span className="text-[10px] text-amber-500/70">💡 Auth secrets are excluded from exports for security</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
