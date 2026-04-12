import { useState, useRef, useEffect } from 'react';
import { useApp } from '../store/AppContext';
import { Clock, FolderOpen, Zap } from 'lucide-react';

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  className?: string;
  onPaste?: (e: React.ClipboardEvent) => void;
}

interface Suggestion {
  url: string;
  method: string;
  name?: string;
  source: 'history' | 'collection' | 'env';
  score: number;
}

export default function UrlAutocomplete({ value, onChange, onSubmit, placeholder, className, onPaste }: Props) {
  const { state } = useApp();
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Build suggestions from history + collections
  const suggestions: Suggestion[] = (() => {
    if (!value || value.length < 2) return [];
    const query = value.toLowerCase();
    const results: Suggestion[] = [];
    const seen = new Set<string>();

    // From history (most recent first)
    state.history.forEach(entry => {
      const url = entry.request.url;
      const key = `${entry.request.method}:${url}`;
      if (seen.has(key)) return;
      if (url.toLowerCase().includes(query) || entry.request.name.toLowerCase().includes(query)) {
        seen.add(key);
        results.push({
          url, method: entry.request.method, name: entry.request.name,
          source: 'history',
          score: url.toLowerCase().startsWith(query) ? 100 : url.toLowerCase().indexOf(query) === -1 ? 10 : 50,
        });
      }
    });

    // From collections
    state.collections.forEach(col => {
      col.requests.forEach(req => {
        const key = `${req.method}:${req.url}`;
        if (seen.has(key)) return;
        if (req.url.toLowerCase().includes(query) || req.name.toLowerCase().includes(query)) {
          seen.add(key);
          results.push({
            url: req.url, method: req.method, name: req.name,
            source: 'collection',
            score: req.url.toLowerCase().startsWith(query) ? 90 : 40,
          });
        }
      });
    });

    // From environment variables — suggest {{var}} completions
    if (value.includes('{{')) {
      const varPrefix = value.match(/\{\{(\w*)$/)?.[1]?.toLowerCase() || '';
      const env = state.environments.find(e => e.id === state.activeEnvironmentId);
      if (env) {
        env.variables.filter(v => v.enabled && v.key.toLowerCase().startsWith(varPrefix)).forEach(v => {
          results.push({
            url: value.replace(/\{\{\w*$/, `{{${v.key}}}`),
            method: '',
            name: `${v.key} = ${v.value}`,
            source: 'env',
            score: 200,
          });
        });
      }
    }

    return results.sort((a, b) => b.score - a.score).slice(0, 8);
  })();

  useEffect(() => {
    setSelectedIdx(0);
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) {
      if (e.key === 'Enter') onSubmit();
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx(prev => Math.min(prev + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (suggestions[selectedIdx]) {
        onChange(suggestions[selectedIdx].url);
        setShowSuggestions(false);
      } else {
        onSubmit();
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  const sourceIcons = {
    history: <Clock size={10} className="text-gray-600" />,
    collection: <FolderOpen size={10} className="text-brand-400/60" />,
    env: <Zap size={10} className="text-amber-400/60" />,
  };

  return (
    <div ref={containerRef} className="relative flex-1">
      <input
        ref={inputRef}
        value={value}
        onChange={e => { onChange(e.target.value); setShowSuggestions(true); }}
        onFocus={() => value.length >= 2 && setShowSuggestions(true)}
        onKeyDown={handleKeyDown}
        onPaste={onPaste}
        placeholder={placeholder}
        className={className}
      />

      {/* Environment variable badge */}
      {value.includes('{{') && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-400 font-mono">ENV</span>
        </div>
      )}

      {/* Suggestions dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-2xl z-30 py-1 max-h-[260px] overflow-y-auto animate-slide-in">
          {suggestions.map((s, i) => (
            <button
              key={`${s.method}:${s.url}:${i}`}
              onClick={() => { onChange(s.url); setShowSuggestions(false); }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors ${
                i === selectedIdx ? 'bg-brand-500/10' : 'hover:bg-gray-700/50'
              }`}
            >
              {sourceIcons[s.source]}
              {s.method && (
                <span className={`font-mono font-bold text-[9px] w-8 flex-shrink-0 method-${s.method.toLowerCase()}`}>
                  {s.method}
                </span>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-200 font-mono truncate">{s.url}</p>
                {s.name && <p className="text-[9px] text-gray-600 truncate">{s.name}</p>}
              </div>
            </button>
          ))}
          <div className="px-3 py-1 border-t border-gray-700/50 flex items-center gap-2 text-[9px] text-gray-600">
            <kbd className="px-1 py-0.5 rounded bg-gray-700 text-gray-500">↑↓</kbd> navigate
            <kbd className="px-1 py-0.5 rounded bg-gray-700 text-gray-500">Enter</kbd> select
            <kbd className="px-1 py-0.5 rounded bg-gray-700 text-gray-500">Esc</kbd> dismiss
          </div>
        </div>
      )}
    </div>
  );
}
