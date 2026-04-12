import { useState } from 'react';
import type { RequestConfig, Collection } from '../types';
import {
  generateCodeSnippet, collectionToShareableJson, requestToShareableJson
} from '../utils/helpers';
import { X, Download, Terminal, FileJson, Code, FileText, Copy, Check } from 'lucide-react';

type ExportTarget =
  | { type: 'request'; request: RequestConfig }
  | { type: 'collection'; collection: Collection };

interface Props {
  target: ExportTarget;
  onClose: () => void;
}

type Format = 'json' | 'curl' | 'javascript' | 'python' | 'go' | 'yaml' | 'txt';

interface FormatOption {
  id: Format;
  label: string;
  ext: string;
  mime: string;
  icon: typeof FileJson;
  iconColor: string;
  description: string;
  available: 'request' | 'collection' | 'both';
}

const formats: FormatOption[] = [
  { id: 'json', label: 'JSON', ext: '.json', mime: 'application/json', icon: FileJson, iconColor: 'text-blue-400', description: 'FetchLab format — importable on any machine', available: 'both' },
  { id: 'curl', label: 'cURL', ext: '.sh', mime: 'text/x-shellscript', icon: Terminal, iconColor: 'text-green-400', description: 'Shell command — run directly in terminal', available: 'request' },
  { id: 'javascript', label: 'JavaScript', ext: '.js', mime: 'text/javascript', icon: Code, iconColor: 'text-amber-400', description: 'fetch() snippet — paste into Node.js or browser', available: 'request' },
  { id: 'python', label: 'Python', ext: '.py', mime: 'text/x-python', icon: Code, iconColor: 'text-blue-500', description: 'requests library — paste into Python script', available: 'request' },
  { id: 'go', label: 'Go', ext: '.go', mime: 'text/x-go', icon: Code, iconColor: 'text-cyan-400', description: 'net/http — paste into Go file', available: 'request' },
  { id: 'txt', label: 'Plain Text', ext: '.txt', mime: 'text/plain', icon: FileText, iconColor: 'text-gray-400', description: 'Human-readable summary', available: 'both' },
];

function generateContent(target: ExportTarget, format: Format): string {
  if (target.type === 'request') {
    const req = target.request;
    switch (format) {
      case 'json':
        return JSON.stringify(requestToShareableJson(req), null, 2);
      case 'curl':
        return generateCodeSnippet(req, 'curl');
      case 'javascript':
        return generateCodeSnippet(req, 'javascript');
      case 'python':
        return generateCodeSnippet(req, 'python');
      case 'go':
        return generateCodeSnippet(req, 'go');
      case 'txt':
        return formatRequestAsText(req);
      default:
        return '';
    }
  } else {
    const col = target.collection;
    switch (format) {
      case 'json':
        return JSON.stringify(collectionToShareableJson(col), null, 2);
      case 'txt':
        return formatCollectionAsText(col);
      default:
        return '';
    }
  }
}

function formatRequestAsText(req: RequestConfig): string {
  let text = `${req.method} ${req.url}\n`;
  text += `Name: ${req.name}\n\n`;
  const headers = req.headers.filter(h => h.enabled && h.key);
  if (headers.length > 0) {
    text += `Headers:\n`;
    headers.forEach(h => { text += `  ${h.key}: ${h.value}\n`; });
    text += '\n';
  }
  const params = req.params.filter(p => p.enabled && p.key);
  if (params.length > 0) {
    text += `Query Parameters:\n`;
    params.forEach(p => { text += `  ${p.key}=${p.value}\n`; });
    text += '\n';
  }
  if (req.body.type !== 'none' && req.body.content) {
    text += `Body (${req.body.type}):\n${req.body.content}\n`;
  }
  return text;
}

function formatCollectionAsText(col: Collection): string {
  let text = `Collection: ${col.name}\n`;
  if (col.description) text += `Description: ${col.description}\n`;
  text += `Requests: ${col.requests.length}\n`;
  text += '─'.repeat(40) + '\n\n';
  col.requests.forEach((req, i) => {
    text += `${i + 1}. ${req.method} ${req.url}\n`;
    text += `   Name: ${req.name}\n`;
    if (req.body.type !== 'none') text += `   Body: ${req.body.type}\n`;
    text += '\n';
  });
  return text;
}

function getFilename(target: ExportTarget, format: FormatOption): string {
  const baseName = target.type === 'request'
    ? (target.request.name || target.request.method + '-request')
    : target.collection.name;
  return baseName.replace(/\s+/g, '-').toLowerCase() + format.ext;
}

export default function ExportDialog({ target, onClose }: Props) {
  const [selectedFormat, setSelectedFormat] = useState<Format>('json');
  const [copied, setCopied] = useState(false);

  const availableFormats = formats.filter(f =>
    f.available === 'both' || f.available === target.type
  );

  const selectedFormatInfo = formats.find(f => f.id === selectedFormat)!;
  const content = generateContent(target, selectedFormat);
  const filename = getFilename(target, selectedFormatInfo);

  const handleDownload = () => {
    const blob = new Blob([content], { type: selectedFormatInfo.mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
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
      <div
        className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-[600px] max-w-[90vw] max-h-[80vh] flex flex-col animate-slide-in"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800">
          <div>
            <h2 className="text-sm font-semibold text-gray-200">
              Export {target.type === 'request' ? 'Request' : 'Collection'}
            </h2>
            <p className="text-[11px] text-gray-500 mt-0.5">
              {target.type === 'request' ? target.request.name || target.request.url : target.collection.name}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-500 hover:text-gray-300 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Format selector */}
        <div className="px-5 py-3 border-b border-gray-800">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-2">Format</p>
          <div className="flex flex-wrap gap-2">
            {availableFormats.map(fmt => (
              <button
                key={fmt.id}
                onClick={() => { setSelectedFormat(fmt.id); setCopied(false); }}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  selectedFormat === fmt.id
                    ? 'bg-brand-500/20 text-brand-400 ring-1 ring-brand-500/30'
                    : 'bg-gray-800/50 text-gray-500 hover:text-gray-300 hover:bg-gray-800'
                }`}
              >
                <fmt.icon size={14} className={selectedFormat === fmt.id ? 'text-brand-400' : fmt.iconColor} />
                {fmt.label}
                <span className="text-[9px] text-gray-600 ml-0.5">{fmt.ext}</span>
              </button>
            ))}
          </div>
          <p className="text-[10px] text-gray-600 mt-2">{selectedFormatInfo.description}</p>
        </div>

        {/* Preview */}
        <div className="flex-1 overflow-auto px-5 py-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Preview</p>
            <span className="text-[10px] text-gray-600 font-mono">{filename}</span>
          </div>
          <pre className="p-3 rounded-lg bg-gray-800/50 border border-gray-800 text-xs font-mono text-gray-300 whitespace-pre-wrap break-all leading-relaxed max-h-[250px] overflow-auto">
            {content}
          </pre>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-gray-800">
          <button
            onClick={handleCopy}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-colors ${
              copied
                ? 'bg-green-500/20 text-green-400'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700'
            }`}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'Copied to clipboard!' : 'Copy to Clipboard'}
          </button>
          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-brand-600 text-white text-xs font-semibold hover:bg-brand-500 transition-colors shadow-lg shadow-brand-600/20"
          >
            <Download size={14} />
            Download {selectedFormatInfo.ext}
          </button>
        </div>
      </div>
    </div>
  );
}
