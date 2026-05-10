import { callAnthropic } from '../ai.js';
import { detectIssue } from './detector.js';
import {
  createAgentIssue, updateAgentIssue, appendAgentAction,
} from '../db.js';
import { buildFullReport } from './reporter.js';
import { getChannel } from './channels.js';

/**
 * Build a fetch-able request from an extracted issue. Returns null if there's
 * not enough information to attempt a reproduction.
 */
export function buildReproRequest(issue) {
  const method = (issue.method || 'GET').toUpperCase();
  let url = issue.url;
  if (!url && issue.endpoint) {
    if (/^https?:\/\//i.test(issue.endpoint)) url = issue.endpoint;
    else url = null; // relative endpoint without a base — can't reproduce
  }
  if (!url) return null;
  return { method, url, headers: {}, body: null };
}

/**
 * Execute an HTTP request and capture the response in a structured form.
 */
export async function executeRequest(req, { fetchImpl = fetch, timeoutMs = 15000 } = {}) {
  const start = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const init = { method: req.method, headers: req.headers || {}, signal: controller.signal };
    if (req.body && !['GET', 'HEAD'].includes(req.method)) {
      init.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      if (!init.headers['Content-Type'] && !init.headers['content-type']) {
        init.headers['Content-Type'] = 'application/json';
      }
    }
    const res = await fetchImpl(req.url, init);
    const text = await res.text();
    const headers = {};
    res.headers?.forEach?.((v, k) => { headers[k] = v; });
    return {
      success: res.ok,
      method: req.method,
      url: req.url,
      status: res.status,
      statusText: res.statusText,
      headers,
      body: text,
      time: Date.now() - start,
    };
  } catch (err) {
    return {
      success: false,
      method: req.method,
      url: req.url,
      status: 0,
      statusText: err.name === 'AbortError' ? 'Timeout' : 'Network error',
      headers: {},
      body: String(err.message || err),
      time: Date.now() - start,
      error: err.message,
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Ask Claude to diagnose the failed response. Returns a structured object
 * matching ai-routes.js /diagnose contract.
 */
export async function diagnoseResponse({ request, response }, { anthropicCall = callAnthropic, fetchImpl } = {}) {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  const ctx = {
    request: {
      method: request.method,
      url: request.url,
      headers: request.headers || {},
      body: typeof request.body === 'string' ? request.body : (request.body ? JSON.stringify(request.body) : ''),
    },
    response: {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers || {},
      body: (response.body || '').slice(0, 2000),
      time: response.time,
    },
  };
  const prompt = `Diagnose this failed HTTP request. Respond ONLY with valid minified JSON of the shape:
{"summary":"...","severity":"critical"|"warning"|"info","likelyCause":"...","fixes":[{"title":"...","detail":"...","code":"..."}]}

Provide 2-4 fixes ordered by likelihood. Reference specific values from the request/response.

${JSON.stringify(ctx)}`;
  try {
    const result = await anthropicCall({ prompt, maxTokens: 800, fetchImpl });
    const match = result.text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

/**
 * Propose a concrete fixed request based on the diagnosis. Currently looks for
 * fix entries that suggest a specific header or auth change. Returns the
 * adjusted request, or null if no automatic adjustment is possible.
 */
export function proposeFixedRequest(originalRequest, diagnosis) {
  if (!diagnosis || !Array.isArray(diagnosis.fixes)) return null;
  const fixed = {
    method: originalRequest.method,
    url: originalRequest.url,
    headers: { ...(originalRequest.headers || {}) },
    body: originalRequest.body,
  };
  let modified = false;

  for (const fix of diagnosis.fixes) {
    const code = fix.code || '';
    // Header line like "Authorization: Bearer …" or "Content-Type: application/json"
    const headerMatch = code.match(/^([A-Za-z0-9-]+)\s*:\s*(.+)$/m);
    if (headerMatch) {
      fixed.headers[headerMatch[1]] = headerMatch[2].trim();
      modified = true;
    }
  }

  return modified ? fixed : null;
}

/**
 * Full orchestration: detect → reproduce → diagnose → propose fix → test → report.
 *
 * `msg` is a normalized inbound message:
 *   { text, channel_id, channel_name, user_id, thread_ts, workspace_id, channel_type }
 *
 * Options:
 *   sensitivity, autoFix, fetchImpl, anthropicCall
 *
 * Returns the final issue record (or null if not detected).
 */
export async function processIncomingMessage(msg, opts = {}) {
  const detected = await detectIssue(msg, opts);
  if (!detected) return null;

  const issue = await createAgentIssue({
    ...detected,
    status: 'detected',
  });
  await appendAgentAction({
    issue_id: issue.id, action_type: 'detected',
    result: { confidence: detected.confidence, endpoint: detected.endpoint, method: detected.method },
  });

  let repro = null;
  let diagnosis = null;
  let fixedRequest = null;
  let testResult = null;

  const reproRequest = buildReproRequest({ ...detected });

  if (reproRequest) {
    await updateAgentIssue(issue.id, { status: 'reproducing' });
    repro = await executeRequest(reproRequest, { fetchImpl: opts.fetchImpl });
    await appendAgentAction({
      issue_id: issue.id, action_type: 'reproduced',
      result: { status: repro.status, time: repro.time, success: repro.success },
    });

    if (!repro.success || repro.status >= 400) {
      diagnosis = await diagnoseResponse({ request: reproRequest, response: repro }, opts);
      if (diagnosis) {
        await updateAgentIssue(issue.id, { status: 'diagnosed', diagnosis });
        await appendAgentAction({
          issue_id: issue.id, action_type: 'diagnosed',
          result: { summary: diagnosis.summary, severity: diagnosis.severity },
        });
      }

      fixedRequest = proposeFixedRequest(reproRequest, diagnosis);
      if (fixedRequest) {
        testResult = await executeRequest(fixedRequest, { fetchImpl: opts.fetchImpl });
        await appendAgentAction({
          issue_id: issue.id, action_type: 'tested',
          result: { status: testResult.status, success: testResult.success },
        });
        if (testResult.success) {
          await updateAgentIssue(issue.id, { status: 'fixed', fix: { request: fixedRequest }, test_result: testResult });
        }
      }
    } else {
      // Reproduced and it works — likely a transient issue
      await updateAgentIssue(issue.id, { status: 'transient' });
    }
  }

  // Report back to the channel
  const channel = getChannel(msg.channel_type || 'slack');
  if (channel && msg.channel_id && opts.reportToChannel !== false) {
    try {
      const blocks = buildFullReport({
        issue: { ...issue, ...detected },
        repro,
        diagnosis,
        testResult,
      });
      const sent = await channel.sendInteractive(msg.channel_id, blocks, { thread_ts: msg.thread_ts });
      await appendAgentAction({
        issue_id: issue.id, action_type: 'reported',
        result: { ts: sent?.ts, channel: msg.channel_id },
      });
    } catch (err) {
      await appendAgentAction({
        issue_id: issue.id, action_type: 'report_failed',
        result: { error: err.message },
      });
    }
  }

  return await updateAgentIssue(issue.id, {});
}
