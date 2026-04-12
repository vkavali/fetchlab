import type { TestResult, ScriptConsoleEntry } from '../types';

interface PreRequestContext {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string;
  variables: Record<string, string>;
}

interface PreRequestResult {
  headers: Record<string, string>;
  variables: Record<string, string>;
  body: string;
  console: ScriptConsoleEntry[];
}

interface TestContext {
  response: { status: number; statusText: string; body: unknown; headers: Record<string, string>; time: number };
  variables: Record<string, string>;
}

interface TestRunResult {
  tests: TestResult[];
  console: ScriptConsoleEntry[];
  variables: Record<string, string>;
}

export function runPreRequestScript(script: string, ctx: PreRequestContext): PreRequestResult {
  const consoleLogs: ScriptConsoleEntry[] = [];
  const headers = { ...ctx.headers };
  const variables = { ...ctx.variables };
  let body = ctx.body;

  const fl = {
    setHeader: (key: string, value: string) => { headers[key] = value; },
    removeHeader: (key: string) => { delete headers[key]; },
    setVariable: (key: string, value: string) => { variables[key] = value; },
    getVariable: (key: string) => variables[key] ?? '',
    setBody: (content: string) => { body = content; },
    timestamp: () => Date.now(),
    isoTimestamp: () => new Date().toISOString(),
    uuid: () => crypto.randomUUID(),
    base64Encode: (s: string) => btoa(s),
    base64Decode: (s: string) => atob(s),
    randomInt: (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min,
  };

  const mockConsole = {
    log: (...args: unknown[]) => consoleLogs.push({ type: 'log', args: args.map(String) }),
    warn: (...args: unknown[]) => consoleLogs.push({ type: 'warn', args: args.map(String) }),
    error: (...args: unknown[]) => consoleLogs.push({ type: 'error', args: args.map(String) }),
  };

  try {
    const fn = new Function('fl', 'console', script);
    fn(fl, mockConsole);
  } catch (err) {
    consoleLogs.push({ type: 'error', args: [`Script error: ${err instanceof Error ? err.message : String(err)}`] });
  }

  return { headers, variables, body, console: consoleLogs };
}

export function runTestScript(script: string, ctx: TestContext): TestRunResult {
  const consoleLogs: ScriptConsoleEntry[] = [];
  const tests: TestResult[] = [];
  const variables = { ...ctx.variables };

  let parsedBody: unknown = ctx.response.body;
  if (typeof parsedBody === 'string') {
    try { parsedBody = JSON.parse(parsedBody as string); } catch { /* keep as string */ }
  }

  const createExpect = (value: unknown) => ({
    toBe: (expected: unknown) => { if (value !== expected) throw new Error(`Expected ${JSON.stringify(expected)} but got ${JSON.stringify(value)}`); },
    toContain: (expected: unknown) => {
      if (Array.isArray(value)) { if (!value.includes(expected)) throw new Error(`Array does not contain ${JSON.stringify(expected)}`); }
      else if (typeof value === 'string') { if (!value.includes(String(expected))) throw new Error(`String does not contain ${JSON.stringify(expected)}`); }
      else throw new Error(`Cannot use toContain on ${typeof value}`);
    },
    toBeGreaterThan: (expected: number) => { if (typeof value !== 'number' || value <= expected) throw new Error(`Expected > ${expected} but got ${value}`); },
    toBeLessThan: (expected: number) => { if (typeof value !== 'number' || value >= expected) throw new Error(`Expected < ${expected} but got ${value}`); },
    toBeTruthy: () => { if (!value) throw new Error(`Expected truthy but got ${JSON.stringify(value)}`); },
    toBeFalsy: () => { if (value) throw new Error(`Expected falsy but got ${JSON.stringify(value)}`); },
    toHaveLength: (expected: number) => {
      const len = Array.isArray(value) ? value.length : typeof value === 'string' ? value.length : undefined;
      if (len !== expected) throw new Error(`Expected length ${expected} but got ${len}`);
    },
    toHaveProperty: (prop: string) => {
      if (typeof value !== 'object' || value === null || !(prop in value)) throw new Error(`Object missing property "${prop}"`);
    },
  });

  const fl = {
    response: { ...ctx.response, body: parsedBody },
    test: (name: string, fn: () => void) => {
      try { fn(); tests.push({ name, passed: true }); }
      catch (err) { tests.push({ name, passed: false, error: err instanceof Error ? err.message : String(err) }); }
    },
    expect: createExpect,
    setVariable: (key: string, value: string) => { variables[key] = value; },
    getVariable: (key: string) => variables[key] ?? '',
  };

  const mockConsole = {
    log: (...args: unknown[]) => consoleLogs.push({ type: 'log', args: args.map(String) }),
    warn: (...args: unknown[]) => consoleLogs.push({ type: 'warn', args: args.map(String) }),
    error: (...args: unknown[]) => consoleLogs.push({ type: 'error', args: args.map(String) }),
  };

  try {
    const fn = new Function('fl', 'console', script);
    fn(fl, mockConsole);
  } catch (err) {
    consoleLogs.push({ type: 'error', args: [`Script error: ${err instanceof Error ? err.message : String(err)}`] });
  }

  return { tests, console: consoleLogs, variables };
}
