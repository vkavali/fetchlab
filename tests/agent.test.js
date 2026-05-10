import { describe, it, expect, beforeEach, vi } from 'vitest';
import { _resetForTests, listAgentIssues, listAgentActions, getAgentConfigByChannel } from '../server/db.js';
import {
  detectIssue, looksApiRelated, quickExtract, classifyWithAi,
} from '../server/agent/detector.js';
import {
  buildReproRequest, executeRequest, proposeFixedRequest,
  diagnoseResponse, processIncomingMessage,
} from '../server/agent/agent.js';
import { registerChannel } from '../server/agent/channels.js';
import {
  detectionBlocks, diagnosisBlocks, reproBlocks, testResultBlocks,
  actionBlocks, buildFullReport,
} from '../server/agent/reporter.js';
import { applyFix, ignoreIssue, snoozeIssue, handleSlackAction } from '../server/agent/actions.js';

beforeEach(() => {
  _resetForTests();
  delete process.env.ANTHROPIC_API_KEY;
});

// =========================================================
// Detector — heuristic helpers
// =========================================================
describe('detector heuristics', () => {
  it('looksApiRelated catches keyword matches', () => {
    expect(looksApiRelated('the /users endpoint is returning 500')).toBe(true);
    expect(looksApiRelated('hey can you grab lunch?')).toBe(false);
    expect(looksApiRelated('GET /api/v2/orders timed out')).toBe(true);
    expect(looksApiRelated('CORS error from auth service')).toBe(true);
  });

  it('looksApiRelated catches contextual references', () => {
    expect(looksApiRelated("it's broken again")).toBe(true);
    expect(looksApiRelated('still failing')).toBe(true);
    expect(looksApiRelated('same error as before')).toBe(true);
  });

  it('quickExtract pulls method, status, url, endpoint', () => {
    const r = quickExtract('POST https://api.example.com/users returned a 401 error');
    expect(r.method).toBe('POST');
    expect(r.errorCode).toBe(401);
    expect(r.url).toBe('https://api.example.com/users');
    expect(r.endpoint).toBe('/users');
  });

  it('quickExtract works with plain endpoint paths', () => {
    const r = quickExtract('GET /v1/orders is broken');
    expect(r.method).toBe('GET');
    expect(r.endpoint).toBe('/v1/orders');
    expect(r.url).toBeUndefined();
  });
});

// =========================================================
// Detector — full detectIssue flow
// =========================================================
describe('detectIssue', () => {
  it('returns null for clearly non-API messages at medium sensitivity', async () => {
    const r = await detectIssue({ text: 'happy birthday Sam!' }, { useAi: false });
    expect(r).toBeNull();
  });

  it('detects an API issue from heuristics alone (no AI key)', async () => {
    const r = await detectIssue(
      { text: 'GET https://api.example.com/users is returning 500', channel_id: 'C1' },
      { useAi: false }
    );
    expect(r).not.toBeNull();
    expect(r.method).toBe('GET');
    expect(r.error_code).toBe(500);
    expect(r.endpoint).toBe('/users');
    expect(r.url).toBe('https://api.example.com/users');
  });

  it('low sensitivity rejects fuzzy reports', async () => {
    const r = await detectIssue(
      { text: 'something is acting weird in the api' },
      { useAi: false, sensitivity: 'low' }
    );
    expect(r).toBeNull();
  });

  it('high sensitivity accepts vague API mentions', async () => {
    const r = await detectIssue(
      { text: 'the api seems off' },
      { useAi: false, sensitivity: 'high' }
    );
    expect(r).not.toBeNull();
  });

  it('uses AI classification when ANTHROPIC_API_KEY is set', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-test';
    const fakeAnthropic = vi.fn().mockResolvedValue({
      text: '{"is_api_issue":true,"confidence":"high","endpoint":"/billing","method":"POST","error_description":"500 from billing svc","status_code":500}',
    });
    const r = await detectIssue(
      { text: 'billing service errored out' },
      { anthropicCall: fakeAnthropic }
    );
    expect(fakeAnthropic).toHaveBeenCalled();
    expect(r).not.toBeNull();
    expect(r.endpoint).toBe('/billing');
    expect(r.method).toBe('POST');
    expect(r.error_code).toBe(500);
    expect(r.confidence).toBe('high');
  });

  it('AI override with high confidence "not an issue" returns null', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-test';
    const fakeAnthropic = vi.fn().mockResolvedValue({
      text: '{"is_api_issue":false,"confidence":"high","endpoint":null,"method":null,"error_description":null,"status_code":null}',
    });
    const r = await detectIssue(
      { text: 'the API of social interactions is broken' },
      { anthropicCall: fakeAnthropic }
    );
    expect(r).toBeNull();
  });

  it('classifyWithAi returns null on unparseable AI output', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-test';
    const fakeAnthropic = vi.fn().mockResolvedValue({ text: 'not json at all' });
    const r = await classifyWithAi('foo', { anthropicCall: fakeAnthropic });
    expect(r).toBeNull();
  });
});

// =========================================================
// Agent loop — buildReproRequest / executeRequest / proposeFix / diagnose
// =========================================================
describe('buildReproRequest', () => {
  it('builds from url', () => {
    expect(buildReproRequest({ url: 'https://api.example.com/x', method: 'POST' }))
      .toEqual({ method: 'POST', url: 'https://api.example.com/x', headers: {}, body: null });
  });

  it('builds from absolute endpoint', () => {
    expect(buildReproRequest({ endpoint: 'https://x.io/y' })?.url).toBe('https://x.io/y');
  });

  it('returns null when only relative endpoint is known', () => {
    expect(buildReproRequest({ endpoint: '/users' })).toBeNull();
  });

  it('defaults to GET', () => {
    const r = buildReproRequest({ url: 'https://x.io/y' });
    expect(r.method).toBe('GET');
  });
});

describe('executeRequest', () => {
  it('captures response status and body on success', async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true, status: 200, statusText: 'OK',
      headers: { forEach: (cb) => cb('application/json', 'content-type') },
      text: async () => '{"ok":true}',
    });
    const r = await executeRequest({ method: 'GET', url: 'https://x.io/y' }, { fetchImpl: fakeFetch });
    expect(r.success).toBe(true);
    expect(r.status).toBe(200);
    expect(r.body).toBe('{"ok":true}');
    expect(typeof r.time).toBe('number');
  });

  it('captures network errors', async () => {
    const fakeFetch = vi.fn().mockRejectedValue(new Error('boom'));
    const r = await executeRequest({ method: 'GET', url: 'https://x.io/y' }, { fetchImpl: fakeFetch });
    expect(r.success).toBe(false);
    expect(r.status).toBe(0);
    expect(r.error).toBe('boom');
  });
});

describe('proposeFixedRequest', () => {
  it('extracts a header from a fix code snippet', () => {
    const orig = { method: 'GET', url: 'x', headers: {}, body: null };
    const diagnosis = {
      fixes: [{ title: 'Add auth header', detail: '...', code: 'Authorization: Bearer YOUR_TOKEN' }],
    };
    const fixed = proposeFixedRequest(orig, diagnosis);
    expect(fixed.headers.Authorization).toBe('Bearer YOUR_TOKEN');
    expect(orig.headers.Authorization).toBeUndefined(); // not mutated
  });

  it('returns null when no actionable fix is present', () => {
    expect(proposeFixedRequest({ method: 'GET', url: 'x', headers: {} }, { fixes: [] })).toBeNull();
    expect(proposeFixedRequest({ method: 'GET', url: 'x', headers: {} }, null)).toBeNull();
  });
});

describe('diagnoseResponse', () => {
  it('returns null without API key', async () => {
    const r = await diagnoseResponse({ request: {}, response: {} });
    expect(r).toBeNull();
  });

  it('parses AI JSON output', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-test';
    const fakeAnthropic = vi.fn().mockResolvedValue({
      text: '{"summary":"Auth missing","severity":"warning","likelyCause":"no token","fixes":[{"title":"add bearer","detail":"...","code":"Authorization: Bearer X"}]}',
    });
    const r = await diagnoseResponse(
      { request: { method: 'GET', url: 'x' }, response: { status: 401, body: '' } },
      { anthropicCall: fakeAnthropic }
    );
    expect(r.summary).toBe('Auth missing');
    expect(r.fixes).toHaveLength(1);
  });

  it('returns null when AI output is malformed', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-test';
    const fakeAnthropic = vi.fn().mockResolvedValue({ text: 'garbage' });
    const r = await diagnoseResponse(
      { request: {}, response: {} },
      { anthropicCall: fakeAnthropic }
    );
    expect(r).toBeNull();
  });
});

// =========================================================
// processIncomingMessage — full orchestration
// =========================================================
describe('processIncomingMessage', () => {
  it('skips messages that are not API-related', async () => {
    const r = await processIncomingMessage(
      { text: 'lunch tomorrow?', channel_id: 'C1' },
      { useAi: false, sensitivity: 'medium', reportToChannel: false }
    );
    expect(r).toBeNull();
    expect(await listAgentIssues({})).toHaveLength(0);
  });

  it('detects, reproduces a 200, marks transient', async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true, status: 200, statusText: 'OK',
      headers: { forEach: (cb) => cb('application/json', 'content-type') },
      text: async () => '{}',
    });
    const r = await processIncomingMessage(
      { text: 'GET https://api.example.com/users is broken with a 500', channel_id: 'C1' },
      { useAi: false, fetchImpl: fakeFetch, reportToChannel: false }
    );
    expect(r).not.toBeNull();
    expect(r.status).toBe('transient');
    expect(fakeFetch).toHaveBeenCalledTimes(1);
    const issues = await listAgentIssues({});
    expect(issues).toHaveLength(1);
    const actions = await listAgentActions({ issue_id: r.id });
    expect(actions.map(a => a.action_type)).toEqual(expect.arrayContaining(['detected', 'reproduced']));
  });

  it('detects, reproduces a 401, diagnoses, applies header fix, verifies', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-test';
    const fakeAnthropic = vi.fn().mockResolvedValue({
      text: '{"summary":"missing auth","severity":"warning","likelyCause":"no Authorization header","fixes":[{"title":"add bearer","detail":"...","code":"Authorization: Bearer X"}]}',
    });
    let callCount = 0;
    const fakeFetch = vi.fn().mockImplementation(async (_url, init) => {
      callCount++;
      if (init?.headers?.Authorization === 'Bearer X') {
        return {
          ok: true, status: 200, statusText: 'OK',
          headers: { forEach: (cb) => cb('application/json', 'content-type') },
          text: async () => '{"data":"ok"}',
        };
      }
      return {
        ok: false, status: 401, statusText: 'Unauthorized',
        headers: { forEach: () => {} },
        text: async () => '{"error":"unauthorized"}',
      };
    });
    const r = await processIncomingMessage(
      { text: 'GET https://api.example.com/secret returns 401', channel_id: 'C1' },
      { useAi: true, anthropicCall: fakeAnthropic, fetchImpl: fakeFetch, reportToChannel: false }
    );
    expect(r).not.toBeNull();
    expect(r.status).toBe('fixed');
    expect(callCount).toBe(2); // initial repro + fixed test
    expect(r.diagnosis?.summary).toBe('missing auth');
    expect(r.test_result?.success).toBe(true);

    const actions = await listAgentActions({ issue_id: r.id });
    const types = actions.map(a => a.action_type);
    expect(types).toEqual(expect.arrayContaining(['detected', 'reproduced', 'diagnosed', 'tested']));
  });

  it('reports to the registered channel adapter', async () => {
    const sentInteractive = vi.fn().mockResolvedValue({ ts: '1.0' });
    registerChannel('slack', {
      type: 'slack',
      async connect() {}, listen() {}, async sendMessage() { return { ts: '1.0' }; },
      sendInteractive: sentInteractive,
      async updateMessage() {}, async disconnect() {},
    });
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true, status: 200, statusText: 'OK',
      headers: { forEach: () => {} },
      text: async () => '{}',
    });
    await processIncomingMessage(
      { text: 'GET https://api.example.com/x failing 500', channel_id: 'C1', channel_type: 'slack' },
      { useAi: false, fetchImpl: fakeFetch }
    );
    expect(sentInteractive).toHaveBeenCalledWith('C1', expect.any(Array), expect.any(Object));
  });
});

// =========================================================
// Reporter — Slack Block Kit formatting
// =========================================================
describe('reporter blocks', () => {
  it('detectionBlocks render summary fields', () => {
    const blocks = detectionBlocks({ method: 'GET', endpoint: '/x', error_code: 500, message_text: 'broken' });
    expect(JSON.stringify(blocks)).toContain('GET');
    expect(JSON.stringify(blocks)).toContain('/x');
    expect(JSON.stringify(blocks)).toContain('500');
  });

  it('diagnosisBlocks render severity emoji', () => {
    const blocks = diagnosisBlocks({ summary: 'oops', severity: 'critical', likelyCause: 'x', fixes: [{ title: 't', detail: 'd' }] });
    expect(JSON.stringify(blocks)).toContain('🔴');
    expect(JSON.stringify(blocks)).toContain('oops');
  });

  it('reproBlocks include status & timing', () => {
    const blocks = reproBlocks({ method: 'GET', url: 'https://x', status: 500, statusText: 'Err', time: 42, body: 'oh no' });
    expect(JSON.stringify(blocks)).toContain('500');
    expect(JSON.stringify(blocks)).toContain('42ms');
  });

  it('testResultBlocks branch on success', () => {
    expect(JSON.stringify(testResultBlocks({ success: true, status: 200, time: 5 }))).toContain('verified');
    expect(JSON.stringify(testResultBlocks({ success: false, status: 500, time: 5 }))).toContain('did not resolve');
  });

  it('actionBlocks include all four buttons', () => {
    const [actions] = actionBlocks('issue-id');
    const ids = actions.elements.map(e => e.action_id);
    expect(ids).toEqual(['agent_apply_fix', 'agent_open_pr', 'agent_snooze', 'agent_ignore']);
  });

  it('buildFullReport stitches sections and ends with context footer', () => {
    const blocks = buildFullReport({
      issue: { id: 'x', method: 'GET', endpoint: '/y', message_text: 'broken' },
      repro: { method: 'GET', url: 'https://x', status: 500, statusText: 'E', time: 1, body: '' },
      diagnosis: { summary: 's', severity: 'warning', fixes: [] },
      testResult: null,
    });
    expect(blocks.at(-1).type).toBe('context');
  });
});

// =========================================================
// Actions — apply, ignore, snooze, slack dispatch
// =========================================================
describe('actions', () => {
  it('handleSlackAction routes to the right handler and returns updated issue', async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: false, status: 500, statusText: 'E', headers: { forEach: () => {} }, text: async () => '',
    });
    const issue = await processIncomingMessage(
      { text: 'GET https://x.io/y broken 500', channel_id: 'C1' },
      { useAi: false, fetchImpl: fakeFetch, reportToChannel: false }
    );
    expect(issue).not.toBeNull();

    const ignored = await handleSlackAction({ action_id: 'agent_ignore', value: issue.id, user: { id: 'u1' } });
    expect(ignored.issue.status).toBe('ignored');
  });

  it('snoozeIssue records duration and remind time', async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: false, status: 500, statusText: 'E', headers: { forEach: () => {} }, text: async () => '',
    });
    const issue = await processIncomingMessage(
      { text: 'POST https://x.io/y returns 500', channel_id: 'C1' },
      { useAi: false, fetchImpl: fakeFetch, reportToChannel: false }
    );
    const r = await snoozeIssue(issue.id, { user_id: 'u', durationMinutes: 30 });
    expect(r.issue.status).toBe('snoozed');
    expect(typeof r.remindAt).toBe('string');
  });

  it('applyFix throws when no fix has been proposed', async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: false, status: 500, statusText: 'E', headers: { forEach: () => {} }, text: async () => '',
    });
    const issue = await processIncomingMessage(
      { text: 'GET https://x.io/y broken 500', channel_id: 'C1' },
      { useAi: false, fetchImpl: fakeFetch, reportToChannel: false }
    );
    await expect(applyFix(issue.id, { user_id: 'u' })).rejects.toThrow(/No fix/);
  });

  it('ignoreIssue throws when issue does not exist', async () => {
    await expect(ignoreIssue('does-not-exist', { user_id: 'u' })).rejects.toThrow(/not found/i);
  });
});

// =========================================================
// Config helpers
// =========================================================
describe('agent config', () => {
  it('upsert + lookup by channel works', async () => {
    const { upsertAgentConfig } = await import('../server/db.js');
    await upsertAgentConfig({ channel_id: 'C123', channel_name: 'eng', sensitivity: 'high', enabled: true, channel_type: 'slack' });
    const cfg = await getAgentConfigByChannel({ channel_type: 'slack', channel_id: 'C123' });
    expect(cfg).not.toBeNull();
    expect(cfg.sensitivity).toBe('high');
  });
});
