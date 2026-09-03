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
  const parts = String(repo).trim().split('/');
  if (parts.length !== 2) return null;
  const [owner, name] = parts;
  if (!/^[A-Za-z0-9_.-]+$/.test(owner) || !/^[A-Za-z0-9_.-]+$/.test(name)) return null;
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

const SOURCE_EXTENSIONS = new Set([
  '.c', '.cc', '.cpp', '.cs', '.css', '.go', '.graphql', '.gql', '.h', '.hpp', '.html',
  '.java', '.js', '.jsx', '.json', '.kt', '.kts', '.md', '.mjs', '.php', '.prisma', '.py',
  '.rb', '.rs', '.scss', '.sh', '.sql', '.svelte', '.swift', '.toml', '.ts', '.tsx', '.vue',
  '.xml', '.yaml', '.yml',
]);

const IGNORED_PATH_RE = /(^|\/)(node_modules|vendor|dist|build|coverage|\.next|\.nuxt|target|Pods|\.git)(\/|$)/i;
const SECRET_PATH_RE = /(^|\/)(\.env(?:\.|$)|secrets?(?:\.|\/|$)|credentials?(?:\.|\/|$))|\.(?:pem|p12|pfx|key)$/i;
const LOCK_FILE_RE = /(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|Cargo\.lock|Podfile\.lock)$/i;

function encodeRepoPath(value) {
  return String(value).split('/').map(encodeURIComponent).join('/');
}

function gitHubError(message, status = 400, code = 'github_error') {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

export function isAllowedMissionPath(path, { existing = true } = {}) {
  if (typeof path !== 'string' || !path || path.length > 240) return false;
  if (path.startsWith('/') || path.includes('\\') || path.split('/').some(part => !part || part === '.' || part === '..')) return false;
  if (IGNORED_PATH_RE.test(path) || SECRET_PATH_RE.test(path) || LOCK_FILE_RE.test(path)) return false;
  if (/^\.github\/workflows\//i.test(path)) return false;
  if (!existing && /^\.github\//i.test(path)) return false;
  return true;
}

function sourceFile(path, size) {
  if (!isAllowedMissionPath(path)) return false;
  if (!Number.isFinite(size) || size < 0 || size > 80_000) return false;
  const basename = path.split('/').pop() || '';
  if (['Dockerfile', 'Makefile', 'Procfile', 'Gemfile'].includes(basename)) return true;
  const dot = basename.lastIndexOf('.');
  return dot >= 0 && SOURCE_EXTENSIONS.has(basename.slice(dot).toLowerCase());
}

/**
 * Return a bounded, immutable view of a repository. File contents are loaded
 * separately after the model chooses the paths it actually needs.
 */
export async function getRepositorySnapshot({ repository, fetchImpl = fetch } = {}, opts = {}) {
  const cfg = getCfg({ ...opts, repo: repository || opts.repo });
  if (!cfg) throw gitHubError('GitHub is not configured for this repository', 503, 'github_not_configured');

  const repo = await gh(cfg, `/repos/${cfg.owner}/${cfg.name}`, {}, fetchImpl);
  const defaultBranch = repo.default_branch || 'main';
  const ref = await gh(cfg, `/repos/${cfg.owner}/${cfg.name}/git/ref/heads/${encodeRepoPath(defaultBranch)}`, {}, fetchImpl);
  const baseSha = ref?.object?.sha;
  if (!baseSha) throw gitHubError('GitHub did not return the default branch commit', 502, 'github_invalid_response');
  const commit = await gh(cfg, `/repos/${cfg.owner}/${cfg.name}/git/commits/${baseSha}`, {}, fetchImpl);
  const treeSha = commit?.tree?.sha;
  if (!treeSha) throw gitHubError('GitHub did not return the repository tree', 502, 'github_invalid_response');
  const tree = await gh(cfg, `/repos/${cfg.owner}/${cfg.name}/git/trees/${treeSha}?recursive=1`, {}, fetchImpl);
  const files = (Array.isArray(tree.tree) ? tree.tree : [])
    .filter(item => item?.type === 'blob' && sourceFile(item.path, Number(item.size || 0)))
    .map(item => ({ path: item.path, size: Number(item.size || 0), sha: item.sha }))
    .slice(0, 900);

  if (files.length === 0) {
    throw gitHubError('No readable source files were found in the repository', 422, 'repository_context_empty');
  }

  return {
    repository: `${cfg.owner}/${cfg.name}`,
    default_branch: defaultBranch,
    base_sha: baseSha,
    tree_sha: treeSha,
    tree_truncated: !!tree.truncated || files.length === 900,
    files,
  };
}

/** Verify repository access without creating a branch, commit, or pull request. */
export async function verifyRepositoryAccess({ repository, fetchImpl = fetch } = {}, opts = {}) {
  const cfg = getCfg({ ...opts, repo: repository || opts.repo });
  if (!cfg) throw gitHubError('GitHub token and repository are required', 400, 'github_config_invalid');
  const repo = await gh(cfg, `/repos/${cfg.owner}/${cfg.name}`, {}, fetchImpl);
  const defaultBranch = repo.default_branch || 'main';
  const ref = await gh(cfg, `/repos/${cfg.owner}/${cfg.name}/git/ref/heads/${encodeRepoPath(defaultBranch)}`, {}, fetchImpl);
  if (!ref?.object?.sha) throw gitHubError('GitHub did not return the default branch commit', 502, 'github_invalid_response');
  if (repo.permissions && repo.permissions.push === false) {
    throw gitHubError('The GitHub token can read this repository but cannot create a branch', 403, 'github_write_required');
  }
  return {
    repository: `${cfg.owner}/${cfg.name}`,
    default_branch: defaultBranch,
    base_sha: ref.object.sha,
    private: !!repo.private,
    can_push: repo.permissions?.push ?? null,
    checked_at: new Date().toISOString(),
  };
}

export async function readRepositoryFiles(snapshot, paths, { fetchImpl = fetch } = {}, opts = {}) {
  const cfg = getCfg({ ...opts, repo: snapshot?.repository || opts.repo });
  if (!cfg) throw gitHubError('GitHub is not configured for this repository', 503, 'github_not_configured');
  const allowed = new Map((snapshot?.files || []).map(file => [file.path, file]));
  const selected = [...new Set(Array.isArray(paths) ? paths : [])].slice(0, 12);
  const output = [];
  let totalBytes = 0;

  for (const path of selected) {
    if (!allowed.has(path) || !isAllowedMissionPath(path)) continue;
    const file = await gh(
      cfg,
      `/repos/${cfg.owner}/${cfg.name}/contents/${encodeRepoPath(path)}?ref=${encodeURIComponent(snapshot.base_sha)}`,
      {},
      fetchImpl
    );
    if (file?.type !== 'file' || file.encoding !== 'base64' || typeof file.content !== 'string') continue;
    const content = Buffer.from(file.content.replace(/\s/g, ''), 'base64').toString('utf8');
    const bytes = Buffer.byteLength(content, 'utf8');
    if (bytes > 80_000 || totalBytes + bytes > 180_000) continue;
    totalBytes += bytes;
    output.push({ path, sha: file.sha || allowed.get(path)?.sha, content });
  }

  if (output.length === 0) {
    throw gitHubError('The selected repository files could not be read', 422, 'repository_files_unreadable');
  }
  return output;
}

function validateProposalFiles(files) {
  if (!Array.isArray(files) || files.length === 0) {
    throw gitHubError('The approved proposal has no file changes', 422, 'proposal_empty');
  }
  if (files.length > 6) throw gitHubError('The approved proposal exceeds the six-file safety limit', 422, 'proposal_too_large');
  const paths = new Set();
  let totalBytes = 0;
  return files.map(file => {
    const path = String(file?.path || '');
    if (!isAllowedMissionPath(path, { existing: file?.existing !== false })) {
      throw gitHubError(`The proposal contains a blocked path: ${path || '(empty)'}`, 422, 'proposal_path_blocked');
    }
    if (paths.has(path)) throw gitHubError(`The proposal contains a duplicate path: ${path}`, 422, 'proposal_path_duplicate');
    paths.add(path);
    if (typeof file.content !== 'string' || file.content.length === 0) {
      throw gitHubError(`The proposal has no content for ${path}`, 422, 'proposal_content_empty');
    }
    const bytes = Buffer.byteLength(file.content, 'utf8');
    totalBytes += bytes;
    if (bytes > 120_000 || totalBytes > 500_000) {
      throw gitHubError('The approved proposal exceeds the source-size safety limit', 422, 'proposal_too_large');
    }
    return { path, content: file.content };
  });
}

function renderMissionPullRequest({ title, missionId, proposal, proposalHash }) {
  const criteria = (proposal.acceptance_criteria || []).map(item => `- [ ] ${item}`).join('\n');
  const files = (proposal.files || []).map(file => `- \`${file.path}\`: ${file.explanation || 'Proposed change'}`).join('\n');
  const risks = (proposal.risks || []).map(item => `- ${item}`).join('\n');
  return `## Product mission\n\n${proposal.summary || title}\n\n**Mission:** \`${missionId}\`\n**Reviewed proposal:** \`${proposalHash}\`\n**Investigated base:** \`${proposal.base_sha}\`\n\n### Customer evidence\n\n${proposal.user_impact || 'See the linked FetchLab mission.'}\n\n### Acceptance criteria\n\n${criteria || '- [ ] Human reviewer confirms the intended outcome.'}\n\n### Files\n\n${files}\n\n### Risks\n\n${risks || '- No specific risks reported. Review the diff and repository checks.'}\n\n---\nCreated as a draft by FetchLab. FetchLab does not merge or deploy this change.\n`;
}

/** Create an atomic commit and draft PR from the exact approved proposal. */
export async function createMissionPullRequest({ missionId, title, proposal, proposalHash, fetchImpl = fetch }, opts = {}) {
  const cfg = getCfg({ ...opts, repo: proposal?.repository || opts.repo });
  if (!cfg) throw gitHubError('GitHub is not configured for this repository', 503, 'github_not_configured');
  if (!proposal?.base_sha || !proposalHash) throw gitHubError('The proposal is missing its reviewed repository state', 422, 'proposal_invalid');
  const files = validateProposalFiles(proposal.files);
  const repo = await gh(cfg, `/repos/${cfg.owner}/${cfg.name}`, {}, fetchImpl);
  const baseBranch = proposal.default_branch || repo.default_branch || 'main';
  const currentRef = await gh(cfg, `/repos/${cfg.owner}/${cfg.name}/git/ref/heads/${encodeRepoPath(baseBranch)}`, {}, fetchImpl);
  const currentBaseSha = currentRef?.object?.sha;
  if (currentBaseSha !== proposal.base_sha) {
    throw gitHubError('The repository changed after investigation. Run the investigation again before approving.', 409, 'repository_base_changed');
  }

  const branch = `fetchlab/mission-${String(missionId).replace(/[^a-z0-9]/gi, '').slice(0, 12).toLowerCase()}`;
  const baseCommit = await gh(cfg, `/repos/${cfg.owner}/${cfg.name}/git/commits/${proposal.base_sha}`, {}, fetchImpl);
  if (!baseCommit?.tree?.sha) throw gitHubError('GitHub did not return the base commit tree', 502, 'github_invalid_response');
  const treeEntries = [];
  for (const file of files) {
    const blob = await gh(cfg, `/repos/${cfg.owner}/${cfg.name}/git/blobs`, {
      method: 'POST',
      body: JSON.stringify({ content: file.content, encoding: 'utf-8' }),
    }, fetchImpl);
    treeEntries.push({ path: file.path, mode: '100644', type: 'blob', sha: blob.sha });
  }
  const tree = await gh(cfg, `/repos/${cfg.owner}/${cfg.name}/git/trees`, {
    method: 'POST',
    body: JSON.stringify({ base_tree: baseCommit.tree.sha, tree: treeEntries }),
  }, fetchImpl);

  try {
    const existingPulls = await gh(
      cfg,
      `/repos/${cfg.owner}/${cfg.name}/pulls?head=${encodeURIComponent(`${cfg.owner}:${branch}`)}&state=open`,
      {},
      fetchImpl
    );
    if (Array.isArray(existingPulls) && existingPulls[0]) {
      const existingPull = existingPulls[0];
      const existingHeadSha = existingPull.head?.sha;
      const existingCommit = existingHeadSha
        ? await gh(cfg, `/repos/${cfg.owner}/${cfg.name}/git/commits/${existingHeadSha}`, {}, fetchImpl)
        : null;
      const sameTree = existingCommit?.tree?.sha === tree.sha;
      const sameBase = Array.isArray(existingCommit?.parents)
        && existingCommit.parents.some(parent => parent?.sha === proposal.base_sha);
      const sameBaseBranch = existingPull.base?.ref === baseBranch;
      if (!existingHeadSha || !sameTree || !sameBase || !sameBaseBranch || existingPull.draft !== true) {
        throw gitHubError('The existing pull request for this mission no longer matches the approved draft. Review it in GitHub before retrying.', 409, 'mission_pull_request_changed');
      }
      return {
        url: existingPull.html_url,
        number: existingPull.number,
        branch,
        head_sha: existingHeadSha,
        base_sha: proposal.base_sha,
        repository: `${cfg.owner}/${cfg.name}`,
        reused: true,
      };
    }
  } catch (error) {
    if (error.status !== 404) throw error;
  }
  const commit = await gh(cfg, `/repos/${cfg.owner}/${cfg.name}/git/commits`, {
    method: 'POST',
    body: JSON.stringify({
      message: `fix: ${String(title || 'complete product mission').slice(0, 120)}`,
      tree: tree.sha,
      parents: [proposal.base_sha],
    }),
  }, fetchImpl);
  let headSha = commit.sha;
  try {
    await gh(cfg, `/repos/${cfg.owner}/${cfg.name}/git/refs`, {
      method: 'POST',
      body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: commit.sha }),
    }, fetchImpl);
  } catch (error) {
    if (error.status === 422) {
      const existingRef = await gh(
        cfg,
        `/repos/${cfg.owner}/${cfg.name}/git/ref/heads/${encodeRepoPath(branch)}`,
        {},
        fetchImpl
      );
      const existingSha = existingRef?.object?.sha;
      const existingCommit = existingSha
        ? await gh(cfg, `/repos/${cfg.owner}/${cfg.name}/git/commits/${existingSha}`, {}, fetchImpl)
        : null;
      const sameTree = existingCommit?.tree?.sha === tree.sha;
      const sameBase = Array.isArray(existingCommit?.parents)
        && existingCommit.parents.some(parent => parent?.sha === proposal.base_sha);
      if (!existingSha || !sameTree || !sameBase) {
        throw gitHubError('A different branch already exists for this mission. Review it in GitHub before retrying.', 409, 'mission_branch_changed');
      }
      headSha = existingSha;
    } else {
      throw error;
    }
  }
  const body = renderMissionPullRequest({ title, missionId, proposal, proposalHash });
  const pull = await gh(cfg, `/repos/${cfg.owner}/${cfg.name}/pulls`, {
    method: 'POST',
    body: JSON.stringify({
      title: `[FetchLab] ${String(title || 'Product mission').slice(0, 180)}`,
      head: branch,
      base: baseBranch,
      body,
      draft: true,
    }),
  }, fetchImpl);
  return {
    url: pull.html_url,
    number: pull.number,
    branch,
    head_sha: pull.head?.sha || headSha,
    base_sha: proposal.base_sha,
    repository: `${cfg.owner}/${cfg.name}`,
    reused: false,
  };
}

export async function getMissionPullRequestValidation({ repository, prNumber, fetchImpl = fetch }, opts = {}) {
  const cfg = getCfg({ ...opts, repo: repository || opts.repo });
  if (!cfg) throw gitHubError('GitHub is not configured for this repository', 503, 'github_not_configured');
  const pull = await gh(cfg, `/repos/${cfg.owner}/${cfg.name}/pulls/${Number(prNumber)}`, {}, fetchImpl);
  const headSha = pull?.head?.sha;
  if (!headSha) throw gitHubError('GitHub did not return the pull request head', 502, 'github_invalid_response');
  const runs = await gh(cfg, `/repos/${cfg.owner}/${cfg.name}/commits/${headSha}/check-runs?per_page=100`, {}, fetchImpl);
  const checkRuns = Array.isArray(runs.check_runs) ? runs.check_runs : [];
  let checks = checkRuns.map(run => ({
    name: run.name,
    status: run.status,
    conclusion: run.conclusion,
    url: run.html_url || run.details_url || null,
  }));

  if (checks.length === 0) {
    const combined = await gh(cfg, `/repos/${cfg.owner}/${cfg.name}/commits/${headSha}/status`, {}, fetchImpl);
    checks = (Array.isArray(combined.statuses) ? combined.statuses : []).map(status => ({
      name: status.context,
      status: status.state === 'pending' ? 'in_progress' : 'completed',
      conclusion: status.state === 'success' ? 'success' : (status.state === 'pending' ? null : 'failure'),
      url: status.target_url || null,
    }));
  }

  const failedConclusions = new Set(['failure', 'cancelled', 'timed_out', 'action_required', 'startup_failure', 'stale']);
  const pending = checks.some(check => check.status !== 'completed' || !check.conclusion);
  const failed = checks.some(check => failedConclusions.has(check.conclusion));
  const verified = checks.length > 0 && !pending && !failed;
  const state = checks.length === 0 ? 'unverified' : failed ? 'failed' : pending ? 'pending' : 'passed';
  return {
    state,
    verified,
    checks,
    head_sha: headSha,
    base_sha: pull.base?.sha || null,
    base_branch: pull.base?.ref || null,
    pull_request_state: pull.state,
    draft: !!pull.draft,
    mergeable: pull.mergeable,
    checked_at: new Date().toISOString(),
  };
}
