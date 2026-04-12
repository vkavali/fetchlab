import { useState } from 'react';
import { useApp } from '../store/AppContext';
import type { Collection } from '../types';
import { generateDocs } from '../utils/docGenerator';
import { X, FileText, Download, Copy, Check, Eye } from 'lucide-react';

interface Props {
  collection: Collection;
  onClose: () => void;
}

export default function DocGenerator({ collection, onClose }: Props) {
  const { state } = useApp();
  const [title, setTitle] = useState(collection.name + ' API');
  const [description, setDescription] = useState(collection.description || '');
  const [includeHeaders, setIncludeHeaders] = useState(true);
  const [includeAuth, setIncludeAuth] = useState(false);
  const [includeExamples, setIncludeExamples] = useState(true);
  const [format, setFormat] = useState<'html' | 'markdown'>('html');
  const [copied, setCopied] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const content = generateDocs(collection, state.history, {
    title, description, includeHeaders, includeAuth, includeExamples, format,
  });

  const handleDownload = () => {
    const ext = format === 'html' ? '.html' : '.md';
    const mime = format === 'html' ? 'text/html' : 'text/markdown';
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = title.replace(/\s+/g, '-').toLowerCase() + ext;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-[700px] max-w-[90vw] max-h-[85vh] flex flex-col animate-slide-in" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-brand-400" />
            <h2 className="text-sm font-semibold text-gray-200">Generate API Docs</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-500 hover:text-gray-300"><X size={16} /></button>
        </div>

        {/* Options */}
        <div className="px-5 py-3 border-b border-gray-800 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Title</span>
              <input value={title} onChange={e => setTitle(e.target.value)}
                className="mt-1 w-full bg-gray-800/50 border border-gray-800 rounded px-2.5 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-brand-500/50" />
            </label>
            <label className="block">
              <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Format</span>
              <div className="flex gap-1 mt-1">
                {(['html', 'markdown'] as const).map(f => (
                  <button key={f} onClick={() => setFormat(f)}
                    className={`flex-1 py-1.5 rounded text-xs font-medium transition-colors ${
                      format === f ? 'bg-brand-500/20 text-brand-400' : 'bg-gray-800/50 text-gray-500 hover:text-gray-300'
                    }`}>
                    {f === 'html' ? 'HTML' : 'Markdown'}
                  </button>
                ))}
              </div>
            </label>
          </div>

          <label className="block">
            <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Description</span>
            <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional description..."
              className="mt-1 w-full bg-gray-800/50 border border-gray-800 rounded px-2.5 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-brand-500/50" />
          </label>

          <div className="flex flex-wrap gap-3">
            {[
              { label: 'Include headers', checked: includeHeaders, onChange: setIncludeHeaders },
              { label: 'Include auth info', checked: includeAuth, onChange: setIncludeAuth },
              { label: 'Include example responses', checked: includeExamples, onChange: setIncludeExamples },
            ].map(opt => (
              <label key={opt.label} className="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" checked={opt.checked} onChange={e => opt.onChange(e.target.checked)}
                  className="w-3.5 h-3.5 rounded bg-gray-800 border-gray-700 text-brand-500 focus:ring-brand-500/30" />
                <span className="text-xs text-gray-400">{opt.label}</span>
              </label>
            ))}
          </div>

          <p className="text-[10px] text-gray-600">
            {collection.requests.length} endpoints • {state.history.filter(h => collection.requests.some(r => r.url === h.request.url)).length} example responses from history
          </p>
        </div>

        {/* Preview */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-5 py-2 border-b border-gray-800">
            <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Preview</span>
            <button onClick={() => setShowPreview(!showPreview)}
              className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-brand-400">
              <Eye size={10} />{showPreview ? 'Show source' : 'Render preview'}
            </button>
          </div>
          <div className="flex-1 overflow-auto">
            {showPreview && format === 'html' ? (
              <iframe srcDoc={content} className="w-full h-full min-h-[300px] bg-gray-950" sandbox="allow-scripts" title="Doc Preview" />
            ) : (
              <pre className="p-4 text-[11px] font-mono text-gray-400 whitespace-pre-wrap break-all leading-relaxed">
                {content.substring(0, 5000)}{content.length > 5000 ? '\n\n... (truncated in preview)' : ''}
              </pre>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-gray-800">
          <button onClick={handleCopy}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-colors ${
              copied ? 'bg-green-500/20 text-green-400' : 'bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700'
            }`}>
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'Copied!' : 'Copy'}
          </button>
          <button onClick={handleDownload}
            className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-brand-600 text-white text-xs font-semibold hover:bg-brand-500 transition-colors shadow-lg shadow-brand-600/20">
            <Download size={14} />
            Download {format === 'html' ? '.html' : '.md'}
          </button>
        </div>
      </div>
    </div>
  );
}
