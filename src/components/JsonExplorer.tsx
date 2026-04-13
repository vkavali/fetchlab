import { useState, useMemo, useCallback } from 'react';
import { ChevronRight, ChevronDown, Copy, Check, Search, Hash, Type, ToggleLeft, List, Braces, X } from 'lucide-react';

interface Props {
  data: string;
}

function getType(v: unknown): string {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  return typeof v;
}

const TYPE_COLORS: Record<string, string> = {
  string: 'text-green-400',
  number: 'text-amber-400',
  boolean: 'text-purple-400',
  null: 'text-gray-500',
  object: 'text-blue-400',
  array: 'text-cyan-400',
};

const TYPE_ICONS: Record<string, typeof Type> = {
  string: Type,
  number: Hash,
  boolean: ToggleLeft,
  null: X,
  object: Braces,
  array: List,
};

function truncateValue(v: unknown, maxLen = 60): string {
  if (v === null) return 'null';
  if (typeof v === 'string') {
    const s = `"${v}"`;
    return s.length > maxLen ? s.substring(0, maxLen) + '…"' : s;
  }
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) return `Array(${v.length})`;
  if (typeof v === 'object') return `{${Object.keys(v as object).length} keys}`;
  return String(v);
}

// Build initial expanded state: expand everything up to given depth
function buildInitialExpanded(data: unknown, maxDepth: number): Set<string> {
  const result = new Set<string>();
  const walk = (v: unknown, path: string, depth: number) => {
    if (depth >= maxDepth) return;
    if (Array.isArray(v)) {
      result.add(path);
      v.forEach((item, i) => walk(item, `${path}[${i}]`, depth + 1));
    } else if (v && typeof v === 'object') {
      result.add(path);
      Object.entries(v).forEach(([k, val]) => walk(val, path ? `${path}.${k}` : k, depth + 1));
    }
  };
  walk(data, '', 0);
  return result;
}

function JsonTreeNode({ nodeKey, value, path, depth, search, expandedSet, onToggle, onCopyPath }: {
  nodeKey: string;
  value: unknown;
  path: string;
  depth: number;
  search: string;
  expandedSet: Set<string>;
  onToggle: (path: string) => void;
  onCopyPath: (path: string) => void;
}) {
  const type = getType(value);
  const isExpandable = type === 'object' || type === 'array';
  const isExpanded = expandedSet.has(path);
  const Icon = TYPE_ICONS[type] || Type;

  const matchesSearch = search && (
    nodeKey.toLowerCase().includes(search.toLowerCase()) ||
    (typeof value === 'string' && value.toLowerCase().includes(search.toLowerCase())) ||
    String(value).toLowerCase().includes(search.toLowerCase())
  );

  // If searching and no match in this subtree, hide
  if (search && !matchesSearch && isExpandable) {
    const hasMatchingChild = JSON.stringify(value).toLowerCase().includes(search.toLowerCase());
    if (!hasMatchingChild) return null;
  }
  if (search && !matchesSearch && !isExpandable) return null;

  const children = isExpandable
    ? (Array.isArray(value)
        ? value.map((v, i) => ({ key: String(i), value: v, path: `${path}[${i}]` }))
        : Object.entries(value as Record<string, unknown>).map(([k, v]) => ({ key: k, value: v, path: path ? `${path}.${k}` : k }))
      )
    : [];

  return (
    <div>
      <div
        className={`flex items-center gap-1.5 py-1 px-1.5 rounded cursor-pointer hover:bg-gray-800/50 group ${
          matchesSearch ? 'bg-amber-500/10 ring-1 ring-amber-500/20' : ''
        }`}
        style={{ paddingLeft: depth * 18 + 6 }}
        onClick={() => isExpandable && onToggle(path)}
      >
        {/* Expand/collapse arrow */}
        <span className="w-4 h-4 flex items-center justify-center flex-shrink-0">
          {isExpandable ? (
            isExpanded
              ? <ChevronDown size={14} className="text-gray-500" />
              : <ChevronRight size={14} className="text-gray-500" />
          ) : (
            <span className="w-1 h-1 rounded-full bg-gray-700" />
          )}
        </span>

        {/* Type icon */}
        <Icon size={11} className={`${TYPE_COLORS[type]} flex-shrink-0 opacity-70`} />

        {/* Key name */}
        <span className="text-blue-300 text-[11px] font-mono font-medium">{nodeKey}</span>

        {/* Separator */}
        <span className="text-gray-600 text-[11px]">:</span>

        {/* Value or summary */}
        {isExpandable ? (
          <span className="text-[10px] text-gray-600 font-mono">
            {isExpanded
              ? (type === 'array' ? `[ ${(value as unknown[]).length} items ]` : `{ ${Object.keys(value as object).length} keys }`)
              : truncateValue(value)
            }
          </span>
        ) : (
          <span className={`text-[11px] font-mono ${TYPE_COLORS[type]}`}>
            {truncateValue(value)}
          </span>
        )}

        {/* Copy path */}
        <button
          onClick={e => { e.stopPropagation(); onCopyPath(path); }}
          className="ml-auto p-1 rounded opacity-0 group-hover:opacity-100 text-gray-600 hover:text-brand-400 transition-all flex-shrink-0"
          title={`Copy: ${path}`}
        >
          <Copy size={10} />
        </button>
      </div>

      {/* Render children when expanded */}
      {isExpandable && isExpanded && (
        <div>
          {children.map(child => (
            <JsonTreeNode
              key={child.path}
              nodeKey={child.key}
              value={child.value}
              path={child.path}
              depth={depth + 1}
              search={search}
              expandedSet={expandedSet}
              onToggle={onToggle}
              onCopyPath={onCopyPath}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function JsonExplorer({ data }: Props) {
  const parsed = useMemo(() => {
    try { return JSON.parse(data); }
    catch { return null; }
  }, [data]);

  // Use a Set for expanded paths — initialized with depth-2 expansion
  const [expandedSet, setExpandedSet] = useState<Set<string>>(() => {
    if (!parsed) return new Set();
    return buildInitialExpanded(parsed, 2);
  });

  const [search, setSearch] = useState('');
  const [copiedPath, setCopiedPath] = useState<string | null>(null);

  const onToggle = useCallback((path: string) => {
    setExpandedSet(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    if (!parsed) return;
    const paths = new Set<string>();
    const walk = (v: unknown, p: string) => {
      if (Array.isArray(v)) { paths.add(p); v.forEach((item, i) => walk(item, `${p}[${i}]`)); }
      else if (v && typeof v === 'object') { paths.add(p); Object.entries(v).forEach(([k, val]) => walk(val, p ? `${p}.${k}` : k)); }
    };
    walk(parsed, '');
    setExpandedSet(paths);
  }, [parsed]);

  const collapseAll = useCallback(() => {
    setExpandedSet(new Set());
  }, []);

  const onCopyPath = useCallback((path: string) => {
    navigator.clipboard.writeText(path);
    setCopiedPath(path);
    setTimeout(() => setCopiedPath(null), 2000);
  }, []);

  if (!parsed) return <pre className="text-xs text-gray-400 font-mono p-3 whitespace-pre-wrap">{data}</pre>;

  const rootEntries = Array.isArray(parsed)
    ? parsed.map((v: unknown, i: number) => ({ key: String(i), value: v, path: `[${i}]` }))
    : Object.entries(parsed).map(([k, v]) => ({ key: k, value: v, path: k }));

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-800/50">
        <div className="relative flex-1">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-600" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search keys or values..."
            className="w-full bg-gray-800/30 border border-gray-800 rounded-lg pl-7 pr-2 py-1.5 text-[11px] text-gray-300 focus:outline-none focus:border-gray-700"
          />
        </div>
        <button onClick={expandAll} className="px-2.5 py-1.5 rounded-lg text-[10px] text-gray-500 hover:text-gray-200 hover:bg-gray-800 transition-colors border border-gray-800">
          Expand all
        </button>
        <button onClick={collapseAll} className="px-2.5 py-1.5 rounded-lg text-[10px] text-gray-500 hover:text-gray-200 hover:bg-gray-800 transition-colors border border-gray-800">
          Collapse
        </button>
      </div>

      {/* Copied toast */}
      {copiedPath && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/10 text-green-400 text-[10px] border-b border-green-500/20">
          <Check size={10} /> Copied path: <code className="font-mono font-medium">{copiedPath}</code>
        </div>
      )}

      {/* Tree view */}
      <div className="flex-1 overflow-auto p-2">
        {rootEntries.map((entry: { key: string; value: unknown; path: string }) => (
          <JsonTreeNode
            key={entry.path}
            nodeKey={entry.key}
            value={entry.value}
            path={entry.path}
            depth={0}
            search={search}
            expandedSet={expandedSet}
            onToggle={onToggle}
            onCopyPath={onCopyPath}
          />
        ))}
      </div>

      {/* Footer stats */}
      <div className="flex items-center justify-between px-3 py-1.5 border-t border-gray-800/50 text-[9px] text-gray-600">
        <span>{rootEntries.length} root {Array.isArray(parsed) ? 'items' : 'keys'}</span>
        <span>{expandedSet.size} nodes expanded</span>
      </div>
    </div>
  );
}
