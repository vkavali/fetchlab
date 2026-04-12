import { useState, useMemo } from 'react';
import { ChevronRight, ChevronDown, Copy, Check, Search, Hash, Type, ToggleLeft, List, Braces, X } from 'lucide-react';

interface Props {
  data: string;
}

interface JsonNode {
  key: string;
  value: unknown;
  path: string;
  type: 'string' | 'number' | 'boolean' | 'null' | 'object' | 'array';
  childCount?: number;
}

function getType(v: unknown): JsonNode['type'] {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  return typeof v as JsonNode['type'];
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

function truncateValue(v: unknown, maxLen = 80): string {
  if (v === null) return 'null';
  if (typeof v === 'string') {
    const s = `"${v}"`;
    return s.length > maxLen ? s.substring(0, maxLen) + '…"' : s;
  }
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) return `Array(${v.length})`;
  if (typeof v === 'object') return `Object(${Object.keys(v as object).length})`;
  return String(v);
}

function JsonTreeNode({ nodeKey, value, path, depth, search, expanded, toggleExpand, onCopyPath }: {
  nodeKey: string;
  value: unknown;
  path: string;
  depth: number;
  search: string;
  expanded: Record<string, boolean>;
  toggleExpand: (path: string) => void;
  onCopyPath: (path: string) => void;
}) {
  const type = getType(value);
  const isExpandable = type === 'object' || type === 'array';
  const isExpanded = expanded[path] ?? depth < 2;
  const Icon = TYPE_ICONS[type] || Type;

  const matchesSearch = search && (
    nodeKey.toLowerCase().includes(search.toLowerCase()) ||
    (typeof value === 'string' && value.toLowerCase().includes(search.toLowerCase())) ||
    String(value).toLowerCase().includes(search.toLowerCase())
  );

  const children = isExpandable
    ? (Array.isArray(value)
        ? value.map((v, i) => ({ key: String(i), value: v, path: `${path}[${i}]` }))
        : Object.entries(value as Record<string, unknown>).map(([k, v]) => ({ key: k, value: v, path: path ? `${path}.${k}` : k }))
      )
    : [];

  // If searching and this node + children don't match, hide
  if (search && !matchesSearch && isExpandable) {
    const hasMatchingChild = JSON.stringify(value).toLowerCase().includes(search.toLowerCase());
    if (!hasMatchingChild) return null;
  }

  return (
    <div>
      <div
        className={`flex items-center gap-1 py-0.5 px-1 rounded group cursor-pointer hover:bg-gray-800/50 ${
          matchesSearch ? 'bg-amber-500/10 ring-1 ring-amber-500/30' : ''
        }`}
        style={{ paddingLeft: depth * 16 + 4 }}
        onClick={() => isExpandable && toggleExpand(path)}
      >
        {/* Expand arrow */}
        <span className="w-4 flex-shrink-0">
          {isExpandable && (
            isExpanded
              ? <ChevronDown size={12} className="text-gray-600" />
              : <ChevronRight size={12} className="text-gray-600" />
          )}
        </span>

        {/* Type icon */}
        <Icon size={10} className={`${TYPE_COLORS[type]} flex-shrink-0 opacity-60`} />

        {/* Key */}
        <span className="text-blue-300 text-xs font-mono">{nodeKey}</span>
        <span className="text-gray-600 text-xs">:</span>

        {/* Value preview */}
        {(!isExpandable || !isExpanded) && (
          <span className={`text-xs font-mono truncate ${TYPE_COLORS[type]}`}>
            {truncateValue(value)}
          </span>
        )}

        {isExpandable && isExpanded && (
          <span className="text-[10px] text-gray-600">
            {type === 'array' ? `[${(value as unknown[]).length}]` : `{${Object.keys(value as object).length}}`}
          </span>
        )}

        {/* Copy path button */}
        <button
          onClick={e => { e.stopPropagation(); onCopyPath(path); }}
          className="ml-auto p-0.5 rounded opacity-0 group-hover:opacity-100 text-gray-600 hover:text-brand-400 transition-all"
          title={`Copy path: ${path}`}
        >
          <Copy size={10} />
        </button>
      </div>

      {/* Children */}
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
              expanded={expanded}
              toggleExpand={toggleExpand}
              onCopyPath={onCopyPath}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function JsonExplorer({ data }: Props) {
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [copiedPath, setCopiedPath] = useState<string | null>(null);

  const parsed = useMemo(() => {
    try { return JSON.parse(data); }
    catch { return null; }
  }, [data]);

  if (!parsed) return <pre className="text-xs text-gray-400 font-mono p-3">{data}</pre>;

  const toggleExpand = (path: string) => {
    setExpanded(prev => ({ ...prev, [path]: !prev[path] }));
  };

  const expandAll = () => {
    const paths: Record<string, boolean> = {};
    const walk = (v: unknown, p: string) => {
      if (Array.isArray(v)) { paths[p] = true; v.forEach((item, i) => walk(item, `${p}[${i}]`)); }
      else if (v && typeof v === 'object') { paths[p] = true; Object.entries(v).forEach(([k, val]) => walk(val, p ? `${p}.${k}` : k)); }
    };
    walk(parsed, '');
    setExpanded(paths);
  };

  const collapseAll = () => setExpanded({});

  const onCopyPath = (path: string) => {
    navigator.clipboard.writeText(path);
    setCopiedPath(path);
    setTimeout(() => setCopiedPath(null), 2000);
  };

  const rootEntries = Array.isArray(parsed)
    ? parsed.map((v: unknown, i: number) => ({ key: String(i), value: v, path: `[${i}]` }))
    : Object.entries(parsed).map(([k, v]) => ({ key: k, value: v, path: k }));

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-800/50">
        <div className="relative flex-1">
          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-600" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search keys or values..."
            className="w-full bg-gray-800/30 border border-gray-800 rounded pl-7 pr-2 py-1 text-[11px] text-gray-300 focus:outline-none focus:border-gray-700"
          />
        </div>
        <button onClick={expandAll} className="px-2 py-1 rounded text-[10px] text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors">
          Expand all
        </button>
        <button onClick={collapseAll} className="px-2 py-1 rounded text-[10px] text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors">
          Collapse
        </button>
      </div>

      {copiedPath && (
        <div className="flex items-center gap-1.5 px-3 py-1 bg-green-500/10 text-green-400 text-[10px]">
          <Check size={10} /> Copied: <code className="font-mono">{copiedPath}</code>
        </div>
      )}

      {/* Tree */}
      <div className="flex-1 overflow-auto p-2 font-mono">
        {rootEntries.map((entry: { key: string; value: unknown; path: string }) => (
          <JsonTreeNode
            key={entry.path}
            nodeKey={entry.key}
            value={entry.value}
            path={entry.path}
            depth={0}
            search={search}
            expanded={expanded}
            toggleExpand={toggleExpand}
            onCopyPath={onCopyPath}
          />
        ))}
      </div>
    </div>
  );
}
