export type DiffType = 'added' | 'removed' | 'changed' | 'unchanged';

export interface DiffEntry {
  path: string;
  type: DiffType;
  oldValue?: unknown;
  newValue?: unknown;
}

export function computeJsonDiff(left: unknown, right: unknown, path = ''): DiffEntry[] {
  if (left === right) return [{ path: path || '(root)', type: 'unchanged', oldValue: left, newValue: right }];

  if (typeof left !== typeof right || left === null || right === null) {
    if (left === undefined) return [{ path, type: 'added', newValue: right }];
    if (right === undefined) return [{ path, type: 'removed', oldValue: left }];
    return [{ path: path || '(root)', type: 'changed', oldValue: left, newValue: right }];
  }

  if (Array.isArray(left) && Array.isArray(right)) {
    const entries: DiffEntry[] = [];
    const maxLen = Math.max(left.length, right.length);
    for (let i = 0; i < maxLen; i++) {
      const p = `${path}[${i}]`;
      if (i >= left.length) entries.push({ path: p, type: 'added', newValue: right[i] });
      else if (i >= right.length) entries.push({ path: p, type: 'removed', oldValue: left[i] });
      else entries.push(...computeJsonDiff(left[i], right[i], p));
    }
    return entries;
  }

  if (typeof left === 'object' && typeof right === 'object') {
    const entries: DiffEntry[] = [];
    const allKeys = new Set([...Object.keys(left as object), ...Object.keys(right as object)]);
    for (const key of allKeys) {
      const p = path ? `${path}.${key}` : key;
      const lv = (left as Record<string, unknown>)[key];
      const rv = (right as Record<string, unknown>)[key];
      if (!(key in (left as object))) entries.push({ path: p, type: 'added', newValue: rv });
      else if (!(key in (right as object))) entries.push({ path: p, type: 'removed', oldValue: lv });
      else entries.push(...computeJsonDiff(lv, rv, p));
    }
    return entries;
  }

  if (left !== right) return [{ path: path || '(root)', type: 'changed', oldValue: left, newValue: right }];
  return [{ path: path || '(root)', type: 'unchanged', oldValue: left, newValue: right }];
}

export function diffSummary(entries: DiffEntry[]) {
  let added = 0, removed = 0, changed = 0;
  for (const e of entries) {
    if (e.type === 'added') added++;
    else if (e.type === 'removed') removed++;
    else if (e.type === 'changed') changed++;
  }
  return { added, removed, changed, total: added + removed + changed };
}
