import { registerChannel, nullAdapter } from './channels.js';
import { processIncomingMessage } from './agent.js';
import { handleSlackAction } from './actions.js';
import { getAgentConfigByChannel } from '../db.js';

let app = null;       // @slack/bolt App instance
let webClient = null; // @slack/web-api WebClient
let botUserId = null;

async function loadBolt() {
  try {
    const bolt = await import('@slack/bolt');
    return bolt;
  } catch {
    return null;
  }
}

async function loadWebApi() {
  try {
    const mod = await import('@slack/web-api');
    return mod;
  } catch {
    return null;
  }
}

/**
 * Build a unified inbound-message object from a Slack event.
 */
function normalizeSlackMessage(evt, channelInfo = {}) {
  return {
    text: evt.text || '',
    channel_type: 'slack',
    channel_id: evt.channel,
    channel_name: channelInfo.name || null,
    user_id: evt.user,
    thread_ts: evt.thread_ts || evt.ts,
    workspace_id: channelInfo.workspace_id || null,
  };
}

/**
 * Connect to Slack via Socket Mode and start listening. Returns true on success.
 *
 * Required env: SLACK_BOT_TOKEN, SLACK_APP_TOKEN, SLACK_SIGNING_SECRET
 */
export async function startSlackBot({ onMessage } = {}) {
  const { SLACK_BOT_TOKEN, SLACK_APP_TOKEN, SLACK_SIGNING_SECRET } = process.env;
  if (!SLACK_BOT_TOKEN || !SLACK_APP_TOKEN || !SLACK_SIGNING_SECRET) {
    console.log('[agent] Slack bot not started — missing SLACK_BOT_TOKEN/SLACK_APP_TOKEN/SLACK_SIGNING_SECRET');
    return false;
  }

  const bolt = await loadBolt();
  if (!bolt) {
    console.log('[agent] @slack/bolt not installed — Slack bot disabled');
    registerChannel('slack', nullAdapter('slack'));
    return false;
  }

  const { App } = bolt;
  app = new App({
    token: SLACK_BOT_TOKEN,
    appToken: SLACK_APP_TOKEN,
    signingSecret: SLACK_SIGNING_SECRET,
    socketMode: true,
  });

  // Register channel adapter so other modules can post back
  registerChannel('slack', {
    type: 'slack',
    async connect() { /* already started */ },
    listen() { /* events bound below */ },
    async sendMessage(channel, text, opts = {}) {
      const r = await app.client.chat.postMessage({ channel, text, thread_ts: opts.thread_ts });
      return { ts: r.ts };
    },
    async sendInteractive(channel, blocks, opts = {}) {
      const r = await app.client.chat.postMessage({ channel, blocks, thread_ts: opts.thread_ts, text: 'FetchLab agent update' });
      return { ts: r.ts };
    },
    async updateMessage(channel, ts, blocks) {
      await app.client.chat.update({ channel, ts, blocks, text: 'FetchLab agent update' });
    },
    async disconnect() { await app.stop(); },
  });

  app.message(async ({ event, message }) => {
    const m = event || message;
    if (!m || m.subtype === 'bot_message' || m.bot_id) return;
    if (m.user === botUserId) return;

    try {
      const cfg = await getAgentConfigByChannel({ channel_type: 'slack', channel_id: m.channel });
      if (!cfg || !cfg.enabled) return;
      const msg = normalizeSlackMessage(m, { workspace_id: cfg.workspace_id });
      if (onMessage) {
        await onMessage(msg);
      } else {
        await processIncomingMessage(msg, { sensitivity: cfg.sensitivity, autoFix: cfg.auto_fix });
      }
    } catch (err) {
      console.error('[agent] slack message handler error:', err.message);
    }
  });

  app.action(/^agent_/, async ({ ack, body, action }) => {
    await ack();
    try {
      const result = await handleSlackAction({
        action_id: action.action_id,
        value: action.value,
        user: body.user,
      });
      await app.client.chat.postMessage({
        channel: body.channel.id,
        thread_ts: body.message?.thread_ts || body.message?.ts,
        text: `🤖 \`${action.action_id}\` → ${result.issue?.status || 'done'}`,
      });
    } catch (err) {
      await app.client.chat.postMessage({
        channel: body.channel.id,
        thread_ts: body.message?.thread_ts || body.message?.ts,
        text: `❌ Action failed: ${err.message}`,
      });
    }
  });

  await app.start();
  try {
    const auth = await app.client.auth.test();
    botUserId = auth.user_id;
  } catch { /* ignore */ }
  console.log('[agent] Slack bot connected via Socket Mode');
  return true;
}

export async function stopSlackBot() {
  if (app) {
    await app.stop().catch(() => {});
    app = null;
  }
}

/**
 * Lightweight web client lookup for tests / one-off message posts when bolt is
 * unavailable. Falls back to using fetch + chat.postMessage directly.
 */
export async function postSlackMessage(channel, text, { thread_ts } = {}, fetchImpl = fetch) {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) throw new Error('SLACK_BOT_TOKEN not set');
  if (app) return app.client.chat.postMessage({ channel, text, thread_ts });
  const web = await loadWebApi();
  if (web?.WebClient) {
    if (!webClient) webClient = new web.WebClient(token);
    return webClient.chat.postMessage({ channel, text, thread_ts });
  }
  const res = await fetchImpl('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ channel, text, thread_ts }),
  });
  return res.json();
}
