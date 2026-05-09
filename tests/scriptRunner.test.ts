import { describe, it, expect } from 'vitest';
import { runPreRequestScript, runTestScript } from '../src/utils/scriptRunner';

describe('runPreRequestScript — fl.* API', () => {
  const baseCtx = {
    url: 'https://api.example.com/users',
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: '',
    variables: {},
  };

  it('sets headers and variables via fl.*', () => {
    const result = runPreRequestScript(`
      fl.setHeader('X-Custom', 'hello');
      fl.setVariable('token', 'abc123');
    `, baseCtx);
    expect(result.headers['X-Custom']).toBe('hello');
    expect(result.variables.token).toBe('abc123');
  });

  it('removes headers', () => {
    const result = runPreRequestScript(`fl.removeHeader('Content-Type');`, baseCtx);
    expect(result.headers['Content-Type']).toBeUndefined();
  });

  it('reads existing variables with fl.getVariable', () => {
    const result = runPreRequestScript(
      `fl.setHeader('X-Existing', fl.getVariable('apiKey'));`,
      { ...baseCtx, variables: { apiKey: 'sk-xxx' } }
    );
    expect(result.headers['X-Existing']).toBe('sk-xxx');
  });

  it('captures console.log output', () => {
    const result = runPreRequestScript(`console.log('hi'); console.warn('warn');`, baseCtx);
    expect(result.console).toEqual([
      { type: 'log', args: ['hi'] },
      { type: 'warn', args: ['warn'] },
    ]);
  });

  it('blocks prototype-pollution keys', () => {
    const result = runPreRequestScript(
      `fl.setHeader('__proto__', 'attack'); fl.setVariable('constructor', 'pwn');`,
      baseCtx
    );
    // Should not be added as own properties
    expect(Object.prototype.hasOwnProperty.call(result.headers, '__proto__')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(result.variables, 'constructor')).toBe(false);
    // Make sure prototype was not polluted
    expect(({} as Record<string, unknown>).attack).toBeUndefined();
    expect(({}).constructor.name).toBe('Object');
  });

  it('exposes fl.uuid, fl.timestamp, fl.base64Encode/Decode', () => {
    const result = runPreRequestScript(`
      fl.setVariable('uid', fl.uuid());
      fl.setVariable('ts', String(fl.timestamp()));
      fl.setVariable('b64', fl.base64Encode('hello'));
      fl.setVariable('dec', fl.base64Decode(fl.base64Encode('roundtrip')));
    `, baseCtx);
    expect(result.variables.uid).toMatch(/^[0-9a-f-]{36}$/);
    expect(Number(result.variables.ts)).toBeGreaterThan(0);
    expect(result.variables.b64).toBe('aGVsbG8=');
    expect(result.variables.dec).toBe('roundtrip');
  });

  it('reports script errors without throwing', () => {
    const result = runPreRequestScript(`throw new Error('oops');`, baseCtx);
    expect(result.console.some(c => c.type === 'error' && c.args[0].includes('oops'))).toBe(true);
  });
});

describe('runTestScript — fl.test / fl.expect', () => {
  const baseCtx = {
    response: {
      status: 200,
      statusText: 'OK',
      body: '{"id":1,"name":"Alice"}',
      headers: { 'content-type': 'application/json' },
      time: 42,
    },
    variables: {},
  };

  it('records passing tests', () => {
    const r = runTestScript(`fl.test('status is 200', () => { fl.expect(fl.response.status).toBe(200); });`, baseCtx);
    expect(r.tests).toEqual([{ name: 'status is 200', passed: true }]);
  });

  it('records failing tests with error message', () => {
    const r = runTestScript(`fl.test('wrong', () => { fl.expect(fl.response.status).toBe(404); });`, baseCtx);
    expect(r.tests[0].passed).toBe(false);
    expect(r.tests[0].error).toMatch(/404/);
  });

  it('parses JSON body and exposes it on fl.response.body', () => {
    const r = runTestScript(`
      fl.test('has id', () => { fl.expect(fl.response.body).toHaveProperty('id'); });
      fl.test('id is 1', () => { fl.expect(fl.response.body.id).toBe(1); });
    `, baseCtx);
    expect(r.tests.every(t => t.passed)).toBe(true);
  });

  it('extracts variables', () => {
    const r = runTestScript(`fl.setVariable('userId', String(fl.response.body.id));`, baseCtx);
    expect(r.variables.userId).toBe('1');
  });

  it('toBeGreaterThan / toBeLessThan / toContain / toHaveLength', () => {
    const r = runTestScript(`
      fl.test('time fast', () => { fl.expect(fl.response.time).toBeLessThan(100); });
      fl.test('status big', () => { fl.expect(fl.response.status).toBeGreaterThan(199); });
      fl.test('string contains', () => { fl.expect('hello world').toContain('world'); });
      fl.test('array length', () => { fl.expect([1,2,3]).toHaveLength(3); });
    `, baseCtx);
    expect(r.tests.every(t => t.passed)).toBe(true);
  });
});
