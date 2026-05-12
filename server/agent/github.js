/**
 * Lightweight GitHub integration. We use direct REST calls instead of
 * pulling in @octokit/rest at runtime so the build stays slim — but
 * @octokit/rest is also installed for callers that prefer it.
 *
 * Set GITHUB_TOKEN and GITHUB_REPO ("owner/name") to enable.
 */
const GITHUB_API = 'https://api.github.com';

function getCfg(opts = {}) {
  const token = opts.token || process.env.GITHUB_TOKEN;
  const repo = opts.repo || process.env.GITHUB_REPO;
  if (!token || !repo) return null;
  const [owner, name] = repo.split('/');
  if (!owner || !name) return null;
  return { token, owner, name };
}

async function gh(cfg, path, init = {}, fetchImpl = fetch) {
  const res = await fetchImpl(`${GITHUB_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!res.ok) {
    const err = new Error(`GitHub ${res.status}: ${data.message || text}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export function isConfigured(opts) {
  return !!getCfg(opts);
}

/**
 * Open a PR carrying the agent's diagnosis. We don't actually mutate code —
 * instead we add a markdown file under `.fetchlab/agent-fixes/<issueId>.md`
 * documenting the recommended change. Engineers turn it into a real patch.
 */
export async function openIssueFixPr({ issue, diagnosis, testResult, fetchImpl = fetch }, opts = {}) {
  const cfg = getCfg(opts);
  if (!cfg) throw new Error('GitHub not configured (set GITHUB_TOKEN and GITHUB_REPO)');

  const branch = `fetchlab/agent-${issue.id.slice(0, 8)}`;
  const repo = await gh(cfg, `/repos/${cfg.owner}/${cfg.name}`, {}, fetchImpl);
  const baseBranch = repo.default_branch || 'main';
  const ref = await gh(cfg, `/repos/${cfg.owner}/${cfg.name}/git/ref/heads/${baseBranch}`, {}, fetchImpl);
  const baseSha = ref.object.sha;

  // Create branch (idempotent)
  try {
    await gh(cfg, `/repos/${cfg.owner}/${cfg.name}/git/refs`, {
      method: 'POST',
      body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: baseSha }),
    }, fetchImpl);
  } catch (err) {
    if (err.status !== 422) throw err; // 422 = ref exists, we can still commit
  }

  const path = `.fetchlab/agent-fixes/${issue.id}.md`;
  const content = renderFixMarkdown({ issue, diagnosis, testResult });
  const contentB64 = Buffer.from(content, 'utf8').toString('base64');

  // Look up existing file SHA on the branch (if any) so we can update
  let existingSha = null;
  try {
    const f = await gh(cfg, `/repos/${cfg.owner}/${cfg.name}/contents/${encodeURIComponent(path)}?ref=${branch}`, {}, fetchImpl);
    existingSha = f.sha;
  } catch (err) {
    if (err.status !== 404) throw err;
  }

  await gh(cfg, `/repos/${cfg.owner}/${cfg.name}/contents/${encodeURIComponent(path)}`, {
    method: 'PUT',
    body: JSON.stringify({
      message: `agent: document fix for ${issue.method || ''} ${issue.endpoint || ''}`.trim(),
      content: contentB64,
      branch,
      ...(existingSha ? { sha: existingSha } : {}),
    }),
  }, fetchImpl);

  // Open PR (idempotent — if one exists, return it)
  try {
    const pr = await gh(cfg, `/repos/${cfg.owner}/${cfg.name}/pulls`, {
      method: 'POST',
      body: JSON.stringify({
        title: `[FetchLab Agent] ${issue.method || ''} ${issue.endpoint || 'issue'}`.trim(),
        head: branch,
        base: baseBranch,
        body: content,
      }),
    }, fetchImpl);
    return { url: pr.html_url, number: pr.number, branch };
  } catch (err) {
    if (err.status === 422) {
      const list = await gh(cfg, `/repos/${cfg.owner}/${cfg.name}/pulls?head=${cfg.owner}:${branch}&state=open`, {}, fetchImpl);
      if (Array.isArray(list) && list[0]) {
        return { url: list[0].html_url, number: list[0].number, branch };
      }
    }
    throw err;
  }
}

function renderFixMarkdown({ issue, diagnosis, testResult }) {
  const fixes = (diagnosis?.fixes || []).map((f, i) =>
    `### ${i + 1}. ${f.title}\n\n${f.detail || ''}\n\n${f.code ? '```\n' + f.code + '\n```' : ''}`
  ).join('\n\n');

  return `# FetchLab Agent — Fix Report

**Issue:** ${issue.message_text || ''}

- **Endpoint:** \`${issue.method || ''} ${issue.endpoint || ''}\`
- **Status code:** \`${issue.error_code || 'n/a'}\`
- **Channel:** ${issue.channel_name || issue.channel_id || 'unknown'}
- **Detected:** ${issue.detected_at || new Date().toISOString()}

## Diagnosis

${diagnosis?.summary || '_No diagnosis available._'}

**Likely cause:** ${diagnosis?.likelyCause || 'unknown'}

## Suggested fixes

${fixes || '_None_'}

## Test result

${testResult ? `\`${testResult.method || ''} ${testResult.url || ''}\` → \`${testResult.status}\` in ${testResult.time}ms (${testResult.success ? 'PASS' : 'FAIL'})` : '_Not run_'}

---
_Generated by the FetchLab AI Ops Agent._
`;
}
