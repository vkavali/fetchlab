/**
 * Channel adapter registry. Each adapter implements:
 *   connect() -> Promise<void>
 *   listen(handler) -> void           // handler(msg) called for each incoming message
 *   sendMessage(channelId, text, opts) -> Promise<{ ts }>
 *   sendInteractive(channelId, blocks, opts) -> Promise<{ ts }>
 *   updateMessage(channelId, ts, blocks) -> Promise<void>
 *   disconnect() -> Promise<void>
 *
 * Slack is the first implementation. Microsoft Teams, Discord, email, etc. can
 * be added by registering additional adapters here.
 */
const adapters = new Map();

export function registerChannel(type, adapter) {
  adapters.set(type, adapter);
}

export function getChannel(type) {
  return adapters.get(type) || null;
}

export function listChannels() {
  return Array.from(adapters.keys());
}

/**
 * Minimal placeholder adapter so unregistered channel types fail gracefully.
 */
export function nullAdapter(type) {
  return {
    type,
    async connect() { /* no-op */ },
    listen() { /* no-op */ },
    async sendMessage() { return { ts: null }; },
    async sendInteractive() { return { ts: null }; },
    async updateMessage() { /* no-op */ },
    async disconnect() { /* no-op */ },
  };
}
