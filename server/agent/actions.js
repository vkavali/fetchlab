import {
  getAgentIssue, updateAgentIssue, appendAgentAction,
} from '../db.js';
import { openIssueFixPr, isConfigured as ghConfigured } from './github.js';

/**
 * Action handlers. Called from API endpoints OR from Slack interactive payloads.
 */

export async function applyFix(issueId, { user_id } = {}) {
  const issue = await getAgentIssue(issueId);
  if (!issue) throw new Error('Issue not found');
  if (!issue.fix) throw new Error('No fix to apply');
  await updateAgentIssue(issueId, { status: 'applied' });
  const action = await appendAgentAction({
    issue_id: issueId,
    action_type: 'apply_fix',
    result: { user_id, fix: issue.fix },
  });
  return { issue: await getAgentIssue(issueId), action };
}

export async function openPr(issueId, { user_id, fetchImpl } = {}) {
  const issue = await getAgentIssue(issueId);
  if (!issue) throw new Error('Issue not found');
  if (!ghConfigured()) {
    throw new Error('GitHub is not configured (set GITHUB_TOKEN and GITHUB_REPO)');
  }
  const pr = await openIssueFixPr({
    issue,
    diagnosis: issue.diagnosis,
    testResult: issue.test_result,
    fetchImpl,
  });
  await updateAgentIssue(issueId, { status: 'pr_opened', fix: { ...(issue.fix || {}), pr_url: pr.url, pr_number: pr.number } });
  const action = await appendAgentAction({
    issue_id: issueId,
    action_type: 'open_pr',
    result: { url: pr.url, number: pr.number, branch: pr.branch, user_id },
  });
  return { issue: await getAgentIssue(issueId), action, pr };
}

export async function ignoreIssue(issueId, { user_id } = {}) {
  const issue = await getAgentIssue(issueId);
  if (!issue) throw new Error('Issue not found');
  await updateAgentIssue(issueId, { status: 'ignored' });
  const action = await appendAgentAction({
    issue_id: issueId,
    action_type: 'ignored',
    result: { user_id },
  });
  return { issue: await getAgentIssue(issueId), action };
}

export async function snoozeIssue(issueId, { user_id, durationMinutes = 60 } = {}) {
  const issue = await getAgentIssue(issueId);
  if (!issue) throw new Error('Issue not found');
  const remindAt = new Date(Date.now() + durationMinutes * 60 * 1000).toISOString();
  await updateAgentIssue(issueId, { status: 'snoozed' });
  const action = await appendAgentAction({
    issue_id: issueId,
    action_type: 'snoozed',
    result: { user_id, remindAt, durationMinutes },
  });
  return { issue: await getAgentIssue(issueId), action, remindAt };
}

/**
 * Slack interactive button dispatch. Slack POSTs an `actions` payload — we
 * map the action_id to the right handler.
 */
export async function handleSlackAction({ action_id, value, user }) {
  const issueId = value;
  const ctx = { user_id: user?.id || user?.username };
  switch (action_id) {
    case 'agent_apply_fix': return applyFix(issueId, ctx);
    case 'agent_open_pr':   return openPr(issueId, ctx);
    case 'agent_ignore':    return ignoreIssue(issueId, ctx);
    case 'agent_snooze':    return snoozeIssue(issueId, ctx);
    default: throw new Error(`Unknown action_id: ${action_id}`);
  }
}
