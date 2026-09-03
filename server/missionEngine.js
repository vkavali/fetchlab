import crypto from 'crypto';
import { assertSafeUrl, ssrfBypassEnabled } from './ssrf.js';
import {
  getRepositorySnapshot,
  isAllowedMissionPath,
  readRepositoryFiles,
} from './agent/github.js';

const MAX_MODEL_SOURCE_CHARS = 90_000;
const MAX_FILE_SOURCE_CHARS = 28_000;

function missionError(message, status = 422, code = 'mission_investigation_failed') {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

export function redactForModel(value) {
  return String(value || '')
    .replace(/\bgh[pousr]_[A-Za-z0-9_]{20,}\b/g, '[REDACTED_SECRET]')
    .replace(/\bsk-[A-Za-z0-9_-]{16,}\b/g, '[REDACTED_SECRET]')
    .replace(/\b(?:glpat-|xox[baprs]-)[A-Za-z0-9_-]{10,}\b/g, '[REDACTED_SECRET]')
    .replace(/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, '[REDACTED_SECRET]')
    .replace(/\bAKIA[A-Z0-9]{16}\b/g, '[REDACTED_SECRET]')
    .replace(/((?:authorization|x-api-key|api-key|cookie|set-cookie)\s*:\s*)[^\r\n]+/gi, '$1[REDACTED_SECRET]')
    .replace(/((?:password|passwd|pwd|secret|token|api[_-]?key|client[_-]?secret)\s*[:=]\s*)(["'`])[^\r\n"'`]{4,}\2/gi, '$1$2[REDACTED_SECRET]$2')
    .replace(/("(?:password|passwd|pwd|secret|token|api[_-]?key|client[_-]?secret)"\s*:\s*")[^"]+("?)/gi, '$1[REDACTED_SECRET]$2')
    .replace(/([?&](?:access[_-]?token|refresh[_-]?token|token|api[_-]?key|secret|password)=)[^&#\s]*/gi, '$1[REDACTED_SECRET]')
    .replace(/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, '[REDACTED_SECRET]');
}

function parseJsonObject(text, label) {
  const raw = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) throw missionError(`${label} did not return JSON`, 502, 'model_invalid_response');
  try {
    const parsed = JSON.parse(raw.slice(start, end + 1));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('object required');
    return parsed;
  } catch {
    throw missionError(`${label} returned invalid JSON`, 502, 'model_invalid_response');
  }
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  }
  return value;
}

export function hashMissionProposal(proposal) {
  const copy = { ...proposal };
  delete copy.proposal_hash;
  return crypto.createHash('sha256').update(JSON.stringify(canonical(copy))).digest('hex');
}

function boundedStrings(value, limit = 8, maxLength = 500) {
  if (!Array.isArray(value)) return [];
  return value
    .filter(item => typeof item === 'string' && item.trim())
    .slice(0, limit)
    .map(item => item.trim().slice(0, maxLength));
}

function safeSummary(value, fallback, maxLength = 2_000) {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, maxLength) : fallback;
}

function containsCredential(text) {
  const value = String(text || '');
  return value.includes('[REDACTED_SECRET]') || redactForModel(value).includes('[REDACTED_SECRET]');
}

function validateProposal(raw, snapshot, sourceFiles) {
  const sourceByPath = new Map(sourceFiles.map(file => [file.path, file]));
  if (!Array.isArray(raw.files) || raw.files.length === 0) {
    throw missionError('The investigation did not produce an exact code change', 422, 'proposal_empty');
  }
  if (raw.files.length > 6) {
    throw missionError('The proposed change is too broad. Narrow the mission and investigate again.', 422, 'proposal_too_large');
  }

  const seen = new Set();
  let totalBytes = 0;
  const files = raw.files.map(item => {
    const path = String(item?.path || '').trim();
    const source = sourceByPath.get(path);
    if (!source || !isAllowedMissionPath(path)) {
      throw missionError(`The model proposed an unread or blocked path: ${path || '(empty)'}`, 422, 'proposal_path_blocked');
    }
    if (seen.has(path)) throw missionError(`The model proposed ${path} more than once`, 422, 'proposal_path_duplicate');
    seen.add(path);
    const content = typeof item?.content === 'string' ? item.content : '';
    if (!content || content === source.content) {
      throw missionError(`The proposal does not contain a changed version of ${path}`, 422, 'proposal_content_invalid');
    }
    if (containsCredential(content)) {
      throw missionError(`The proposal for ${path} contains credential material or a redaction marker`, 422, 'proposal_contains_secret');
    }
    const bytes = Buffer.byteLength(content, 'utf8');
    totalBytes += bytes;
    if (bytes > 120_000 || totalBytes > 500_000) {
      throw missionError('The proposed source change exceeds the review safety limit', 422, 'proposal_too_large');
    }
    return {
      path,
      existing: true,
      original_sha: source.sha,
      explanation: safeSummary(item.explanation, 'Proposed code change', 700),
      content,
    };
  });

  const proposal = {
    repository: snapshot.repository,
    default_branch: snapshot.default_branch,
    base_sha: snapshot.base_sha,
    summary: safeSummary(raw.summary, 'Proposed product change'),
    user_impact: safeSummary(raw.user_impact, 'Review the original customer evidence.'),
    root_cause: safeSummary(raw.root_cause, 'The likely cause requires human confirmation.'),
    acceptance_criteria: boundedStrings(raw.acceptance_criteria, 8, 500),
    risks: boundedStrings(raw.risks, 8, 500),
    manual_review: boundedStrings(raw.manual_review, 8, 500),
    source_files: sourceFiles.map(file => ({ path: file.path, sha: file.sha })),
    files,
  };
  if (proposal.acceptance_criteria.length === 0) {
    throw missionError('The proposal did not define measurable acceptance criteria', 422, 'proposal_missing_acceptance');
  }
  proposal.proposal_hash = hashMissionProposal(proposal);
  return proposal;
}

export async function probeMissionUrl(input, { fetchImpl = fetch, timeoutMs = 10_000 } = {}) {
  if (!input) return null;
  if (!ssrfBypassEnabled()) await assertSafeUrl(input);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();
  try {
    const response = await fetchImpl(input, {
      method: 'GET',
      redirect: 'manual',
      signal: controller.signal,
      headers: { 'User-Agent': 'FetchLab-Mission/1.0', Accept: 'text/html,application/json,text/plain;q=0.8,*/*;q=0.2' },
    });
    const body = await readBoundedResponse(response);
    return {
      kind: 'availability_probe',
      url: input,
      reachable: response.status > 0 && response.status < 500,
      status: response.status,
      status_text: response.statusText,
      content_type: response.headers?.get?.('content-type') || '',
      excerpt: redactForModel(body).slice(0, 1_200),
      duration_ms: Date.now() - started,
      checked_at: new Date().toISOString(),
      claim: 'Availability only. This does not prove the reported problem was reproduced.',
    };
  } catch (error) {
    return {
      kind: 'availability_probe',
      url: input,
      reachable: false,
      status: 0,
      status_text: error?.name === 'AbortError' ? 'Timeout' : 'Network error',
      content_type: '',
      excerpt: '',
      duration_ms: Date.now() - started,
      checked_at: new Date().toISOString(),
      claim: 'Availability only. This does not prove the reported problem was reproduced.',
    };
  } finally {
    clearTimeout(timer);
  }
}

async function readBoundedResponse(response, maxBytes = 64 * 1024) {
  const reader = response.body?.getReader?.();
  if (!reader) return String(await response.text()).slice(0, maxBytes);

  const decoder = new TextDecoder();
  let bytesRead = 0;
  let output = '';
  try {
    while (bytesRead < maxBytes) {
      const { done, value } = await reader.read();
      if (done) break;
      const remaining = maxBytes - bytesRead;
      const chunk = value.byteLength > remaining ? value.subarray(0, remaining) : value;
      output += decoder.decode(chunk, { stream: true });
      bytesRead += chunk.byteLength;
      if (chunk.byteLength < value.byteLength) {
        await reader.cancel();
        break;
      }
    }
    output += decoder.decode();
    return output;
  } finally {
    if (bytesRead >= maxBytes) await reader.cancel().catch(() => {});
  }
}

function sourcePayload(files) {
  let remaining = MAX_MODEL_SOURCE_CHARS;
  const output = [];
  for (const file of files) {
    if (remaining <= 0) break;
    const content = redactForModel(file.content);
    if (content.length > MAX_FILE_SOURCE_CHARS || content.length > remaining) continue;
    remaining -= content.length;
    output.push({ path: file.path, sha: file.sha, content });
  }
  return output;
}

export async function investigateMission(mission, { provider, fetchImpl = fetch, githubOptions = {} } = {}) {
  if (!provider || provider.name === 'local') {
    throw missionError('Configure an external AI provider before investigating a repository', 503, 'ai_not_configured');
  }
  const input = mission?.data?.input || {};
  const evidence = redactForModel(input.evidence).slice(0, 20_000);
  const outcome = redactForModel(input.outcome).slice(0, 2_000);
  if (!evidence || !outcome) throw missionError('The mission needs both customer evidence and a desired outcome', 400, 'mission_input_incomplete');

  const snapshot = await getRepositorySnapshot({ repository: input.repository, fetchImpl }, githubOptions);
  const availability = input.app_url
    ? await probeMissionUrl(input.app_url, { fetchImpl })
    : null;
  const pathList = snapshot.files.map(file => `${file.path} (${file.size} bytes)`).join('\n');
  const selectionResult = await provider.chat([
    {
      role: 'system',
      content: 'You investigate software product problems. Select only repository files needed to understand and fix the evidence. Return JSON only. Do not propose code yet.',
    },
    {
      role: 'user',
      content: `Mission title: ${redactForModel(mission.title)}\nDesired outcome: ${outcome}\nCustomer evidence:\n${evidence}\n\nAvailability probe:\n${JSON.stringify(availability)}\n\nRepository files:\n${pathList}\n\nReturn exactly this shape: {"paths":["path"],"reason":"why these files","questions":["missing fact"]}. Select 1-12 existing paths. If the evidence cannot support a responsible change, return no paths and ask precise questions.`,
    },
  ], { maxTokens: 1_500, temperature: 0 });
  const selection = parseJsonObject(selectionResult.content, 'Repository selection');
  const selectedPaths = boundedStrings(selection.paths, 12, 240).filter(path => snapshot.files.some(file => file.path === path));
  const questions = boundedStrings(selection.questions, 8, 500);
  if (selectedPaths.length === 0) {
    return {
      outcome: 'needs_input',
      investigation: {
        repository: snapshot.repository,
        default_branch: snapshot.default_branch,
        base_sha: snapshot.base_sha,
        availability,
        reason: safeSummary(selection.reason, 'The evidence is not specific enough to select repository context.'),
        questions: questions.length ? questions : ['Which user action fails, and what should happen instead?'],
      },
      proposal: null,
    };
  }

  const repositoryFiles = await readRepositoryFiles(snapshot, selectedPaths, { fetchImpl }, githubOptions);
  const modelFiles = sourcePayload(repositoryFiles);
  if (modelFiles.length === 0) {
    throw missionError('The selected files are too large to review safely. Narrow the mission or identify smaller source files.', 422, 'repository_context_too_large');
  }
  const modelFilePaths = new Set(modelFiles.map(file => file.path));
  const reviewedSourceFiles = repositoryFiles.filter(file => modelFilePaths.has(file.path));
  const proposalResult = await provider.chat([
    {
      role: 'system',
      content: 'You are a senior product engineer preparing a small, reviewable fix from real customer evidence. Return JSON only. Preserve existing behavior outside the mission. Never include secrets. Change only the supplied existing files, no more than six. Return complete replacement content for every changed file.',
    },
    {
      role: 'user',
      content: `Mission title: ${redactForModel(mission.title)}\nDesired outcome: ${outcome}\nCustomer evidence:\n${evidence}\n\nAvailability probe:\n${JSON.stringify(availability)}\n\nRepository: ${snapshot.repository}\nBase commit: ${snapshot.base_sha}\n\nRelevant files:\n${JSON.stringify(modelFiles)}\n\nReturn exactly: {"summary":"what changes","user_impact":"why this solves the reported problem","root_cause":"likely cause grounded in the supplied files","acceptance_criteria":["observable result"],"risks":["risk"],"manual_review":["what a reviewer must confirm"],"files":[{"path":"existing/path","explanation":"why","content":"complete replacement file content"}]}. Do not use markdown fences.`,
    },
  ], { maxTokens: 8_000, temperature: 0 });
  const rawProposal = parseJsonObject(proposalResult.content, 'Code proposal');
  const proposal = validateProposal(rawProposal, snapshot, reviewedSourceFiles);
  return {
    outcome: 'proposed',
    investigation: {
      repository: snapshot.repository,
      default_branch: snapshot.default_branch,
      base_sha: snapshot.base_sha,
      tree_truncated: snapshot.tree_truncated,
      considered_file_count: snapshot.files.length,
      selected_files: reviewedSourceFiles.map(file => ({ path: file.path, sha: file.sha })),
      selection_reason: safeSummary(selection.reason, 'Selected from the repository tree.'),
      questions,
      availability,
      provider: provider.name,
      completed_at: new Date().toISOString(),
    },
    proposal,
  };
}
