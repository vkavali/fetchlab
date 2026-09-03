import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  hashMissionProposal,
  investigateMission,
  probeMissionUrl,
  redactForModel,
} from '../server/missionEngine.js';
import {
  createMissionPullRequest,
  getMissionPullRequestValidation,
  isAllowedMissionPath,
  verifyRepositoryAccess,
} from '../server/agent/github.js';

function jsonResponse(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

afterEach(() => {
  delete process.env.SSRF_DISABLED;
});

describe('mission proposal safety', () => {
  it('uses a stable fingerprint and excludes the fingerprint field itself', () => {
    const a = { summary: 'Fix it', files: [{ path: 'src/a.js', content: 'new' }], risks: [] };
    const b = { risks: [], files: [{ content: 'new', path: 'src/a.js' }], summary: 'Fix it', proposal_hash: 'ignored' };
    expect(hashMissionProposal(a)).toBe(hashMissionProposal(b));
    expect(hashMissionProposal({ ...a, summary: 'Different' })).not.toBe(hashMissionProposal(a));
  });

  it('redacts common credentials before model calls', () => {
    const githubToken = ['ghp', '_', 'abcdefghijklmnopqrstuvwxyz123456'].join('');
    const slackToken = ['xoxb', '-', '1234567890', '-', 'abcdefghijklmnop'].join('');
    const jwt = ['eyJhbGciOiJIUzI1NiJ9', 'eyJzdWIiOiIxMjM0NTY3ODkwIn0', 'abcdefghijklmnopqrstuvwxyz'].join('.');
    const redacted = redactForModel(`Authorization: Bearer abcdefghijklmnopqrstuvwxyz ${githubToken} ${slackToken} api_key = "plain-text-secret-value" ${jwt}`);
    expect(redacted).not.toContain('abcdefghijklmnopqrstuvwxyz');
    expect(redacted).not.toContain('plain-text-secret-value');
    expect(redacted).toContain('[REDACTED_SECRET]');
  });

  it('bounds availability response reads and labels them as availability only', async () => {
    process.env.SSRF_DISABLED = '1';
    let reads = 0;
    let cancelled = false;
    const body = new ReadableStream({
      pull(controller) {
        reads += 1;
        controller.enqueue(new Uint8Array(16 * 1024).fill(97));
        if (reads >= 20) controller.close();
      },
      cancel() { cancelled = true; },
    });
    const fetchImpl = vi.fn(async () => ({
      status: 200,
      statusText: 'OK',
      headers: new Headers({ 'content-type': 'text/plain' }),
      body,
    }));

    const result = await probeMissionUrl('https://staging.example.com', { fetchImpl });

    expect(result).toMatchObject({ reachable: true, status: 200, kind: 'availability_probe' });
    expect(result.claim).toMatch(/does not prove/i);
    expect(result.excerpt).toHaveLength(1_200);
    expect(reads).toBeLessThan(20);
    expect(cancelled).toBe(true);
  });

  it('blocks traversal, secret files, generated dependencies, and workflow changes', () => {
    expect(isAllowedMissionPath('src/app.ts')).toBe(true);
    expect(isAllowedMissionPath('../app.ts')).toBe(false);
    expect(isAllowedMissionPath('.env.production')).toBe(false);
    expect(isAllowedMissionPath('node_modules/a.js')).toBe(false);
    expect(isAllowedMissionPath('.github/workflows/release.yml')).toBe(false);
  });
});

describe('mission investigation', () => {
  it('turns evidence and bounded repository context into an exact proposal', async () => {
    const original = 'export function total(a, b) {\n  return a + b;\n}\n';
    const changed = 'export function total(a, b) {\n  if (a == null || b == null) return 0;\n  return a + b;\n}\n';
    const fetchImpl = vi.fn(async (input) => {
      const url = new URL(String(input));
      if (url.pathname === '/repos/acme/shop') return jsonResponse({ default_branch: 'main' });
      if (url.pathname === '/repos/acme/shop/git/ref/heads/main') return jsonResponse({ object: { sha: 'base-sha' } });
      if (url.pathname === '/repos/acme/shop/git/commits/base-sha') return jsonResponse({ tree: { sha: 'tree-sha' } });
      if (url.pathname === '/repos/acme/shop/git/trees/tree-sha') {
        return jsonResponse({ tree: [{ type: 'blob', path: 'src/total.js', size: original.length, sha: 'file-sha' }] });
      }
      if (url.pathname === '/repos/acme/shop/contents/src/total.js') {
        return jsonResponse({ type: 'file', encoding: 'base64', sha: 'file-sha', content: Buffer.from(original).toString('base64') });
      }
      throw new Error(`Unexpected URL ${url}`);
    });
    const provider = {
      name: 'anthropic',
      chat: vi.fn()
        .mockResolvedValueOnce({ content: JSON.stringify({ paths: ['src/total.js'], reason: 'Contains total calculation', questions: [] }) })
        .mockResolvedValueOnce({
          content: JSON.stringify({
            summary: 'Handle missing cart amounts',
            user_impact: 'Checkout no longer shows NaN when one amount is missing.',
            root_cause: 'The total helper adds nullable values without a guard.',
            acceptance_criteria: ['A missing amount returns a numeric total instead of NaN.'],
            risks: ['Confirm whether zero is the intended fallback.'],
            manual_review: ['Review the zero fallback with the checkout owner.'],
            files: [{ path: 'src/total.js', explanation: 'Guard nullable values.', content: changed }],
          }),
        }),
    };
    const mission = {
      id: 'mission-1',
      title: 'Checkout total becomes NaN',
      data: { input: { repository: 'acme/shop', outcome: 'Customers always see a numeric total.', evidence: 'Support ticket: checkout shows NaN when discount amount is missing.', app_url: '' } },
    };

    const result = await investigateMission(mission, {
      provider,
      fetchImpl,
      githubOptions: { token: 'github-token' },
    });

    expect(result.outcome).toBe('proposed');
    expect(result.proposal.files).toEqual([
      expect.objectContaining({ path: 'src/total.js', content: changed, original_sha: 'file-sha' }),
    ]);
    expect(result.proposal.base_sha).toBe('base-sha');
    expect(result.proposal.proposal_hash).toHaveLength(64);
    expect(provider.chat).toHaveBeenCalledTimes(2);
  });

  it('returns questions without inventing a change when no file can be selected', async () => {
    const fetchImpl = vi.fn(async (input) => {
      const url = new URL(String(input));
      if (url.pathname === '/repos/acme/shop') return jsonResponse({ default_branch: 'main' });
      if (url.pathname.endsWith('/git/ref/heads/main')) return jsonResponse({ object: { sha: 'base-sha' } });
      if (url.pathname.endsWith('/git/commits/base-sha')) return jsonResponse({ tree: { sha: 'tree-sha' } });
      if (url.pathname.endsWith('/git/trees/tree-sha')) return jsonResponse({ tree: [{ type: 'blob', path: 'src/app.js', size: 20, sha: 'file-sha' }] });
      throw new Error(`Unexpected URL ${url}`);
    });
    const provider = {
      name: 'anthropic',
      chat: vi.fn().mockResolvedValue({ content: JSON.stringify({ paths: [], reason: 'No failing behavior supplied', questions: ['What did the user expect?'] }) }),
    };
    const result = await investigateMission({
      title: 'Unclear report',
      data: { input: { repository: 'acme/shop', outcome: 'Resolve the user problem.', evidence: 'A customer said that the page did not work for them yesterday.' } },
    }, { provider, fetchImpl, githubOptions: { token: 'github-token' } });
    expect(result.outcome).toBe('needs_input');
    expect(result.proposal).toBeNull();
    expect(result.investigation.questions).toEqual(['What did the user expect?']);
  });
});

describe('GitHub mission execution', () => {
  it('verifies repository write access without mutating it', async () => {
    const fetchImpl = vi.fn(async (input, init = {}) => {
      const url = new URL(String(input));
      expect(init.method || 'GET').toBe('GET');
      if (url.pathname === '/repos/acme/shop') {
        return jsonResponse({ default_branch: 'main', private: true, permissions: { push: true } });
      }
      if (url.pathname.endsWith('/git/ref/heads/main')) return jsonResponse({ object: { sha: 'base-sha' } });
      throw new Error(`Unexpected URL ${url}`);
    });
    await expect(verifyRepositoryAccess({ repository: 'acme/shop', fetchImpl }, { token: 'github-token' }))
      .resolves.toMatchObject({ repository: 'acme/shop', base_sha: 'base-sha', can_push: true });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('commits the exact proposal to a mission branch and opens a draft PR', async () => {
    const requests = [];
    let blobNumber = 0;
    const fetchImpl = vi.fn(async (input, init = {}) => {
      const url = new URL(String(input));
      const method = init.method || 'GET';
      const body = init.body ? JSON.parse(init.body) : null;
      requests.push({ path: url.pathname, search: url.search, method, body });
      if (url.pathname === '/repos/acme/shop' && method === 'GET') return jsonResponse({ default_branch: 'main' });
      if (url.pathname.endsWith('/git/ref/heads/main')) return jsonResponse({ object: { sha: 'base-sha' } });
      if (url.pathname.endsWith('/pulls') && method === 'GET') return jsonResponse([]);
      if (url.pathname.endsWith('/git/commits/base-sha') && method === 'GET') return jsonResponse({ tree: { sha: 'base-tree' } });
      if (url.pathname.endsWith('/git/blobs') && method === 'POST') return jsonResponse({ sha: `blob-${++blobNumber}` });
      if (url.pathname.endsWith('/git/trees') && method === 'POST') return jsonResponse({ sha: 'new-tree' });
      if (url.pathname.endsWith('/git/commits') && method === 'POST') return jsonResponse({ sha: 'new-commit' });
      if (url.pathname.endsWith('/git/refs') && method === 'POST') return jsonResponse({ ref: body.ref });
      if (url.pathname.endsWith('/pulls') && method === 'POST') {
        return jsonResponse({ html_url: 'https://github.com/acme/shop/pull/17', number: 17, head: { sha: 'new-commit' } });
      }
      throw new Error(`Unexpected ${method} ${url}`);
    });
    const proposal = {
      repository: 'acme/shop',
      default_branch: 'main',
      base_sha: 'base-sha',
      summary: 'Fix checkout',
      user_impact: 'Checkout works',
      acceptance_criteria: ['Checkout total is numeric.'],
      risks: [],
      files: [{ path: 'src/total.js', existing: true, explanation: 'Guard null', content: 'export const total = () => 0;\n' }],
    };
    const proposalHash = hashMissionProposal(proposal);
    const result = await createMissionPullRequest({
      missionId: '12345678-1234-4123-8123-123456789abc',
      title: 'Fix checkout total',
      proposal,
      proposalHash,
      fetchImpl,
    }, { token: 'github-token' });

    expect(result).toMatchObject({ number: 17, branch: 'fetchlab/mission-123456781234', base_sha: 'base-sha' });
    const blobWrite = requests.find(item => item.path.endsWith('/git/blobs'));
    expect(blobWrite.body.content).toBe('export const total = () => 0;\n');
    const pullWrite = requests.find(item => item.path.endsWith('/pulls') && item.method === 'POST');
    expect(pullWrite.body.draft).toBe(true);
    expect(pullWrite.body.base).toBe('main');
  });

  it('refuses to write when the default branch changed after investigation', async () => {
    const fetchImpl = vi.fn(async (input) => {
      const url = new URL(String(input));
      if (url.pathname === '/repos/acme/shop') return jsonResponse({ default_branch: 'main' });
      if (url.pathname.endsWith('/git/ref/heads/main')) return jsonResponse({ object: { sha: 'newer-sha' } });
      throw new Error(`Unexpected write after stale base: ${url}`);
    });
    await expect(createMissionPullRequest({
      missionId: 'mission-1',
      title: 'Fix it',
      proposal: {
        repository: 'acme/shop',
        default_branch: 'main',
        base_sha: 'old-sha',
        files: [{ path: 'src/app.js', content: 'changed' }],
      },
      proposalHash: 'hash',
      fetchImpl,
    }, { token: 'github-token' })).rejects.toMatchObject({ status: 409, code: 'repository_base_changed' });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('recovers a matching branch after a lost pull-request response', async () => {
    const fetchImpl = vi.fn(async (input, init = {}) => {
      const url = new URL(String(input));
      const method = init.method || 'GET';
      if (url.pathname === '/repos/acme/shop') return jsonResponse({ default_branch: 'main' });
      if (url.pathname.endsWith('/git/ref/heads/main')) return jsonResponse({ object: { sha: 'base-sha' } });
      if (url.pathname.endsWith('/pulls') && method === 'GET') return jsonResponse([]);
      if (url.pathname.endsWith('/git/commits/base-sha')) return jsonResponse({ tree: { sha: 'base-tree' } });
      if (url.pathname.endsWith('/git/blobs') && method === 'POST') return jsonResponse({ sha: 'blob-sha' });
      if (url.pathname.endsWith('/git/trees') && method === 'POST') return jsonResponse({ sha: 'proposal-tree' });
      if (url.pathname.endsWith('/git/commits') && method === 'POST') return jsonResponse({ sha: 'new-dangling-commit' });
      if (url.pathname.endsWith('/git/refs') && method === 'POST') return jsonResponse({ message: 'Reference already exists' }, 422);
      if (url.pathname.includes('/git/ref/heads/fetchlab/mission-')) return jsonResponse({ object: { sha: 'existing-commit' } });
      if (url.pathname.endsWith('/git/commits/existing-commit')) {
        return jsonResponse({ tree: { sha: 'proposal-tree' }, parents: [{ sha: 'base-sha' }] });
      }
      if (url.pathname.endsWith('/pulls') && method === 'POST') {
        return jsonResponse({ html_url: 'https://github.com/acme/shop/pull/18', number: 18, head: { sha: 'existing-commit' } });
      }
      throw new Error(`Unexpected ${method} ${url}`);
    });
    const result = await createMissionPullRequest({
      missionId: '87654321-1234-4123-8123-123456789abc',
      title: 'Recover checkout fix',
      proposal: {
        repository: 'acme/shop',
        default_branch: 'main',
        base_sha: 'base-sha',
        files: [{ path: 'src/total.js', content: 'export const total = () => 0;\n' }],
      },
      proposalHash: 'approved-hash',
      fetchImpl,
    }, { token: 'github-token' });
    expect(result).toMatchObject({ number: 18, head_sha: 'existing-commit', reused: false });
  });

  it('reuses an existing draft PR only when its tree and base still match the approved proposal', async () => {
    const fetchImpl = vi.fn(async (input, init = {}) => {
      const url = new URL(String(input));
      const method = init.method || 'GET';
      if (url.pathname === '/repos/acme/shop') return jsonResponse({ default_branch: 'main' });
      if (url.pathname.endsWith('/git/ref/heads/main')) return jsonResponse({ object: { sha: 'base-sha' } });
      if (url.pathname.endsWith('/git/commits/base-sha')) return jsonResponse({ tree: { sha: 'base-tree' } });
      if (url.pathname.endsWith('/git/blobs') && method === 'POST') return jsonResponse({ sha: 'blob-sha' });
      if (url.pathname.endsWith('/git/trees') && method === 'POST') return jsonResponse({ sha: 'proposal-tree' });
      if (url.pathname.endsWith('/pulls') && method === 'GET') {
        return jsonResponse([{
          html_url: 'https://github.com/acme/shop/pull/19',
          number: 19,
          draft: true,
          base: { ref: 'main' },
          head: { sha: 'existing-commit' },
        }]);
      }
      if (url.pathname.endsWith('/git/commits/existing-commit')) {
        return jsonResponse({ tree: { sha: 'proposal-tree' }, parents: [{ sha: 'base-sha' }] });
      }
      throw new Error(`Unexpected ${method} ${url}`);
    });

    const result = await createMissionPullRequest({
      missionId: 'aaaaaaaa-1234-4123-8123-123456789abc',
      title: 'Reuse exact draft',
      proposal: {
        repository: 'acme/shop',
        default_branch: 'main',
        base_sha: 'base-sha',
        files: [{ path: 'src/total.js', content: 'export const total = () => 0;\n' }],
      },
      proposalHash: 'approved-hash',
      fetchImpl,
    }, { token: 'github-token' });

    expect(result).toMatchObject({ number: 19, head_sha: 'existing-commit', reused: true });
    expect(fetchImpl.mock.calls.some(([, init]) => init?.method === 'POST' && JSON.parse(init.body || '{}').draft === true)).toBe(false);
  });

  it('refuses to reuse a mission PR after its branch content changes', async () => {
    const fetchImpl = vi.fn(async (input, init = {}) => {
      const url = new URL(String(input));
      const method = init.method || 'GET';
      if (url.pathname === '/repos/acme/shop') return jsonResponse({ default_branch: 'main' });
      if (url.pathname.endsWith('/git/ref/heads/main')) return jsonResponse({ object: { sha: 'base-sha' } });
      if (url.pathname.endsWith('/git/commits/base-sha')) return jsonResponse({ tree: { sha: 'base-tree' } });
      if (url.pathname.endsWith('/git/blobs') && method === 'POST') return jsonResponse({ sha: 'blob-sha' });
      if (url.pathname.endsWith('/git/trees') && method === 'POST') return jsonResponse({ sha: 'proposal-tree' });
      if (url.pathname.endsWith('/pulls') && method === 'GET') {
        return jsonResponse([{
          html_url: 'https://github.com/acme/shop/pull/20',
          number: 20,
          draft: true,
          base: { ref: 'main' },
          head: { sha: 'tampered-commit' },
        }]);
      }
      if (url.pathname.endsWith('/git/commits/tampered-commit')) {
        return jsonResponse({ tree: { sha: 'different-tree' }, parents: [{ sha: 'base-sha' }] });
      }
      throw new Error(`Unexpected ${method} ${url}`);
    });

    await expect(createMissionPullRequest({
      missionId: 'bbbbbbbb-1234-4123-8123-123456789abc',
      title: 'Reject changed draft',
      proposal: {
        repository: 'acme/shop',
        default_branch: 'main',
        base_sha: 'base-sha',
        files: [{ path: 'src/total.js', content: 'export const total = () => 0;\n' }],
      },
      proposalHash: 'approved-hash',
      fetchImpl,
    }, { token: 'github-token' })).rejects.toMatchObject({ status: 409, code: 'mission_pull_request_changed' });

    expect(fetchImpl.mock.calls.some(([input, init]) => {
      const path = new URL(String(input)).pathname;
      return init?.method === 'POST' && (path.endsWith('/git/commits') || path.endsWith('/git/refs') || path.endsWith('/pulls'));
    })).toBe(false);
  });

  it('distinguishes no checks, pending checks, and verified checks', async () => {
    const validationFetch = (checkRuns) => vi.fn(async (input) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith('/pulls/17')) return jsonResponse({
        state: 'open',
        draft: true,
        mergeable: true,
        head: { sha: 'head-sha' },
        base: { sha: 'base-sha', ref: 'main' },
      });
      if (url.pathname.endsWith('/check-runs')) return jsonResponse({ check_runs: checkRuns });
      if (url.pathname.endsWith('/status')) return jsonResponse({ statuses: [] });
      throw new Error(`Unexpected URL ${url}`);
    });

    const unverified = await getMissionPullRequestValidation({ repository: 'acme/shop', prNumber: 17, fetchImpl: validationFetch([]) }, { token: 'github-token' });
    expect(unverified).toMatchObject({ state: 'unverified', verified: false, checks: [] });

    const pending = await getMissionPullRequestValidation({
      repository: 'acme/shop',
      prNumber: 17,
      fetchImpl: validationFetch([{ name: 'test', status: 'in_progress', conclusion: null }]),
    }, { token: 'github-token' });
    expect(pending).toMatchObject({ state: 'pending', verified: false });

    const passed = await getMissionPullRequestValidation({
      repository: 'acme/shop',
      prNumber: 17,
      fetchImpl: validationFetch([{ name: 'test', status: 'completed', conclusion: 'success' }]),
    }, { token: 'github-token' });
    expect(passed).toMatchObject({
      state: 'passed',
      verified: true,
      base_sha: 'base-sha',
      base_branch: 'main',
      pull_request_state: 'open',
      draft: true,
    });

    const stale = await getMissionPullRequestValidation({
      repository: 'acme/shop',
      prNumber: 17,
      fetchImpl: validationFetch([{ name: 'test', status: 'completed', conclusion: 'stale' }]),
    }, { token: 'github-token' });
    expect(stale).toMatchObject({ state: 'failed', verified: false });
  });
});
