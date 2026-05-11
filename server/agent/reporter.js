/**
 * Format agent findings into Slack Block Kit messages. Pure functions — no I/O.
 * The Slack adapter calls these and posts the result.
 */

function code(s, max = 1500) {
  if (!s) return '';
  const str = typeof s === 'string' ? s : JSON.stringify(s, null, 2);
  return '```\n' + (str.length > max ? str.slice(0, max) + '\n... [truncated]' : str) + '\n```';
}

export function detectionBlocks(issue) {
  const head = `🔎 *FetchLab Agent* detected a possible API issue`;
  const detail = [
    issue.method ? `*Method:* \`${issue.method}\`` : null,
    issue.endpoint ? `*Endpoint:* \`${issue.endpoint}\`` : null,
    issue.error_code ? `*Status:* \`${issue.error_code}\`` : null,
    issue.confidence ? `*Confidence:* ${issue.confidence}` : null,
  ].filter(Boolean).join('   ');
  return [
    { type: 'section', text: { type: 'mrkdwn', text: head } },
    { type: 'context', elements: [{ type: 'mrkdwn', text: detail || '_no fields extracted_' }] },
    { type: 'section', text: { type: 'mrkdwn', text: `> ${(issue.message_text || '').slice(0, 280)}` } },
  ];
}

export function reproBlocks({ method, url, status, statusText, time, body }) {
  return [
    { type: 'section', text: { type: 'mrkdwn', text: `🧪 *Reproduced:* \`${method} ${url}\` → \`${status} ${statusText || ''}\` in ${time}ms` } },
    { type: 'section', text: { type: 'mrkdwn', text: code(body, 800) } },
  ];
}

export function diagnosisBlocks(diagnosis) {
  if (!diagnosis) return [];
  const sevEmoji = diagnosis.severity === 'critical' ? '🔴' : diagnosis.severity === 'warning' ? '🟡' : '🔵';
  const blocks = [
    { type: 'section', text: { type: 'mrkdwn', text: `${sevEmoji} *Diagnosis:* ${diagnosis.summary || ''}` } },
  ];
  if (diagnosis.likelyCause) {
    blocks.push({ type: 'context', elements: [{ type: 'mrkdwn', text: `Likely cause: ${diagnosis.likelyCause}` }] });
  }
  if (Array.isArray(diagnosis.fixes) && diagnosis.fixes.length) {
    const fixLines = diagnosis.fixes.slice(0, 4).map((f, i) => {
      const c = f.code ? `\n\`${f.code}\`` : '';
      return `*${i + 1}. ${f.title}*\n${f.detail || ''}${c}`;
    }).join('\n\n');
    blocks.push({ type: 'section', text: { type: 'mrkdwn', text: fixLines } });
  }
  return blocks;
}

export function testResultBlocks(testResult) {
  if (!testResult) return [];
  const ok = testResult.success;
  const head = ok
    ? `✅ *Fix verified:* \`${testResult.method || ''} ${testResult.url || ''}\` → \`${testResult.status}\` in ${testResult.time}ms`
    : `⚠️ *Fix did not resolve:* status \`${testResult.status || 'n/a'}\``;
  return [{ type: 'section', text: { type: 'mrkdwn', text: head } }];
}

export function actionBlocks(issueId) {
  return [
    {
      type: 'actions',
      block_id: `agent_actions_${issueId}`,
      elements: [
        { type: 'button', action_id: 'agent_apply_fix', text: { type: 'plain_text', text: '✅ Apply Fix' }, style: 'primary', value: issueId },
        { type: 'button', action_id: 'agent_open_pr', text: { type: 'plain_text', text: '🔧 Open PR' }, value: issueId },
        { type: 'button', action_id: 'agent_snooze', text: { type: 'plain_text', text: '⏰ Snooze 1h' }, value: issueId },
        { type: 'button', action_id: 'agent_ignore', text: { type: 'plain_text', text: 'Ignore' }, value: issueId, style: 'danger' },
      ],
    },
  ];
}

export function buildFullReport({ issue, repro, diagnosis, testResult }) {
  const blocks = [];
  blocks.push(...detectionBlocks(issue));
  if (repro) blocks.push({ type: 'divider' }, ...reproBlocks(repro));
  if (diagnosis) blocks.push({ type: 'divider' }, ...diagnosisBlocks(diagnosis));
  if (testResult) blocks.push({ type: 'divider' }, ...testResultBlocks(testResult));
  if (issue.id) blocks.push({ type: 'divider' }, ...actionBlocks(issue.id));
  blocks.push({
    type: 'context',
    elements: [{ type: 'mrkdwn', text: `_FetchLab AI Ops Agent_ · ${new Date().toLocaleTimeString()}` }],
  });
  return blocks;
}
