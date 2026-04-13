import { useState, useMemo } from 'react';
import {
  CheckCircle2, XCircle, Plus, X, Zap
} from 'lucide-react';
import { generateId } from '../utils/helpers';

interface SchemaRule {
  id: string;
  path: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'any';
  required: boolean;
  condition?: 'equals' | 'contains' | 'gt' | 'lt' | 'minLength' | 'maxLength' | 'regex';
  conditionValue?: string;
}

interface ValidationResult {
  rule: SchemaRule;
  passed: boolean;
  actual?: string;
  error?: string;
}

function extractByPath(obj: unknown, path: string): unknown {
  if (!path || path === '(root)') return obj;

  // Tokenize: "foo.bar[0].baz" → ["foo", "bar", "[0]", "baz"]
  // Also handles paths starting with [0] like "[0].id"
  const tokens: string[] = [];
  let i = 0;
  while (i < path.length) {
    if (path[i] === '.') { i++; continue; }
    if (path[i] === '[') {
      const end = path.indexOf(']', i);
      if (end === -1) break;
      tokens.push(path.substring(i, end + 1)); // e.g. "[0]"
      i = end + 1;
    } else {
      let end = i;
      while (end < path.length && path[end] !== '.' && path[end] !== '[') end++;
      tokens.push(path.substring(i, end));
      i = end;
    }
  }

  let cur: unknown = obj;
  for (const token of tokens) {
    if (cur === undefined || cur === null) return undefined;
    if (token.startsWith('[') && token.endsWith(']')) {
      const idx = parseInt(token.slice(1, -1));
      if (Array.isArray(cur)) cur = cur[idx];
      else return undefined;
    } else {
      if (typeof cur === 'object' && cur !== null && token in (cur as Record<string, unknown>)) {
        cur = (cur as Record<string, unknown>)[token];
      } else {
        return undefined;
      }
    }
  }
  return cur;
}

function validateRule(rule: SchemaRule, data: unknown): ValidationResult {
  const value = extractByPath(data, rule.path);

  // Check required
  if (value === undefined || value === null) {
    if (rule.required) return { rule, passed: false, error: `Missing required field "${rule.path}"` };
    return { rule, passed: true, actual: 'not present (optional)' };
  }

  // Check type
  const actualType = Array.isArray(value) ? 'array' : typeof value;
  if (rule.type !== 'any' && actualType !== rule.type) {
    return { rule, passed: false, actual: actualType, error: `Expected ${rule.type}, got ${actualType}` };
  }

  // Check condition
  if (rule.condition && rule.conditionValue !== undefined) {
    const cv = rule.conditionValue;
    switch (rule.condition) {
      case 'equals':
        if (String(value) !== cv) return { rule, passed: false, actual: String(value), error: `Expected "${cv}", got "${value}"` };
        break;
      case 'contains':
        if (!String(value).includes(cv)) return { rule, passed: false, actual: String(value), error: `Does not contain "${cv}"` };
        break;
      case 'gt':
        if (typeof value !== 'number' || value <= Number(cv)) return { rule, passed: false, actual: String(value), error: `Expected > ${cv}` };
        break;
      case 'lt':
        if (typeof value !== 'number' || value >= Number(cv)) return { rule, passed: false, actual: String(value), error: `Expected < ${cv}` };
        break;
      case 'minLength': {
        const len = Array.isArray(value) ? value.length : typeof value === 'string' ? value.length : 0;
        if (len < Number(cv)) return { rule, passed: false, actual: `length=${len}`, error: `Length < ${cv}` };
        break;
      }
      case 'maxLength': {
        const len = Array.isArray(value) ? value.length : typeof value === 'string' ? value.length : 0;
        if (len > Number(cv)) return { rule, passed: false, actual: `length=${len}`, error: `Length > ${cv}` };
        break;
      }
      case 'regex':
        try {
          if (!new RegExp(cv).test(String(value))) return { rule, passed: false, actual: String(value), error: `Does not match /${cv}/` };
        } catch { return { rule, passed: false, error: `Invalid regex: ${cv}` }; }
        break;
    }
  }

  return { rule, passed: true, actual: truncate(String(value)) };
}

function truncate(s: string, max = 50) { return s.length > max ? s.substring(0, max) + '…' : s; }

interface Props {
  responseBody: string;
}

export default function SchemaValidator({ responseBody }: Props) {
  const [rules, setRules] = useState<SchemaRule[]>(() => {
    try {
      const saved = localStorage.getItem('fetchlab_schema_rules');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const saveRules = (newRules: SchemaRule[]) => {
    setRules(newRules);
    try { localStorage.setItem('fetchlab_schema_rules', JSON.stringify(newRules)); } catch {}
  };

  const parsed = useMemo(() => {
    try { return JSON.parse(responseBody); } catch { return null; }
  }, [responseBody]);

  const results = useMemo(() => {
    if (!parsed || rules.length === 0) return [];
    return rules.map(r => validateRule(r, parsed));
  }, [parsed, rules]);

  const passCount = results.filter(r => r.passed).length;
  const failCount = results.filter(r => !r.passed).length;

  const addRule = () => {
    saveRules([...rules, { id: generateId(), path: '', type: 'any', required: true }]);
  };

  const updateRule = (id: string, updates: Partial<SchemaRule>) => {
    saveRules(rules.map(r => r.id === id ? { ...r, ...updates } : r));
  };

  const removeRule = (id: string) => {
    saveRules(rules.filter(r => r.id !== id));
  };

  // Auto-generate rules from response
  const autoGenerate = () => {
    if (!parsed) return;
    const newRules: SchemaRule[] = [];
    const walk = (obj: unknown, path: string, depth: number) => {
      if (depth > 2) return;
      if (Array.isArray(obj)) {
        newRules.push({ id: generateId(), path: path || '(root)', type: 'array', required: true });
        if (obj.length > 0) walk(obj[0], path ? `${path}[0]` : '[0]', depth + 1);
      } else if (obj && typeof obj === 'object') {
        Object.entries(obj as Record<string, unknown>).forEach(([key, val]) => {
          const p = path ? `${path}.${key}` : key;
          const type = val === null ? 'any' : Array.isArray(val) ? 'array' : typeof val as SchemaRule['type'];
          newRules.push({ id: generateId(), path: p, type, required: true });
          if (typeof val === 'object' && val !== null) walk(val, p, depth + 1);
        });
      }
    };
    walk(parsed, '', 0);
    saveRules(newRules.slice(0, 30));
  };

  return (
    <div className="p-3 space-y-3">
      {/* Summary */}
      {results.length > 0 && (
        <div className={`flex items-center gap-3 p-2.5 rounded-lg border ${
          failCount === 0 ? 'bg-green-500/10 border-green-500/20' : 'bg-red-500/10 border-red-500/20'
        }`}>
          {failCount === 0
            ? <CheckCircle2 size={16} className="text-green-400" />
            : <XCircle size={16} className="text-red-400" />
          }
          <span className="text-xs font-medium text-gray-200">
            {failCount === 0 ? 'All validations passed' : `${failCount} validation${failCount > 1 ? 's' : ''} failed`}
          </span>
          <span className="text-[10px] text-gray-500 ml-auto">{passCount}/{results.length} passed</span>
        </div>
      )}

      {/* Validation results */}
      {results.map((r, i) => (
        <div key={i} className={`flex items-start gap-2 p-2 rounded-lg border ${
          r.passed ? 'bg-green-500/5 border-green-500/10' : 'bg-red-500/5 border-red-500/10'
        }`}>
          {r.passed ? <CheckCircle2 size={12} className="text-green-400 mt-0.5" /> : <XCircle size={12} className="text-red-400 mt-0.5" />}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <code className="text-[10px] text-gray-300 font-mono">{r.rule.path}</code>
              <span className="text-[9px] text-gray-600">{r.rule.type}</span>
              {r.rule.required && <span className="text-[8px] text-amber-500">required</span>}
            </div>
            {r.error && <p className="text-[10px] text-red-400/80 mt-0.5">{r.error}</p>}
            {r.actual && r.passed && <p className="text-[10px] text-gray-600 mt-0.5">{r.actual}</p>}
          </div>
        </div>
      ))}

      {/* Rule builder */}
      <div className="border-t border-gray-800 pt-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Schema Rules</span>
          <div className="flex gap-1">
            <button onClick={autoGenerate} disabled={!parsed}
              className="flex items-center gap-1 px-2 py-1 rounded text-[10px] text-accent-400 hover:bg-accent-500/10 transition-colors disabled:opacity-50">
              <Zap size={10} /> Auto-detect
            </button>
            <button onClick={addRule}
              className="flex items-center gap-1 px-2 py-1 rounded text-[10px] text-brand-400 hover:bg-brand-500/10 transition-colors">
              <Plus size={10} /> Add rule
            </button>
          </div>
        </div>

        <div className="space-y-1.5">
          {rules.map(rule => (
            <div key={rule.id} className="flex items-center gap-1.5 group">
              <input value={rule.path} onChange={e => updateRule(rule.id, { path: e.target.value })} placeholder="e.g. data.users[0].name"
                className="flex-1 bg-gray-800/30 border border-gray-800 rounded px-2 py-1 text-[10px] font-mono text-gray-300 focus:outline-none focus:border-gray-700" />
              <select value={rule.type} onChange={e => updateRule(rule.id, { type: e.target.value as SchemaRule['type'] })}
                className="bg-gray-800 border border-gray-800 rounded px-1 py-1 text-[10px] text-gray-400">
                <option value="any">any</option><option value="string">string</option><option value="number">number</option>
                <option value="boolean">bool</option><option value="array">array</option><option value="object">object</option>
              </select>
              <label className="flex items-center gap-0.5 text-[9px] text-gray-500 cursor-pointer">
                <input type="checkbox" checked={rule.required} onChange={e => updateRule(rule.id, { required: e.target.checked })}
                  className="w-3 h-3 rounded bg-gray-800 border-gray-700 text-brand-500" /> req
              </label>
              <button onClick={() => removeRule(rule.id)} className="p-0.5 text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100">
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
