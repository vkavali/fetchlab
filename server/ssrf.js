import dns from 'dns/promises';
import net from 'net';

// Private / loopback / link-local / reserved ranges that should never be
// reachable from a server-side proxy. IPv4 + IPv6.
const BLOCKED_V4 = [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],   // CGNAT
  ['127.0.0.0', 8],     // loopback
  ['169.254.0.0', 16],  // link-local / AWS metadata
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],     // multicast
  ['240.0.0.0', 4],     // reserved
  ['255.255.255.255', 32],
];

const BLOCKED_V6_PREFIXES = [
  '::1',
  'fe80::',
  'fc00::',
  'fd00::',
  '::',
  '::ffff:',
];

function ipv4ToInt(ip) {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some(p => Number.isNaN(p) || p < 0 || p > 255)) return null;
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

function inV4Range(ip, base, prefix) {
  const ipInt = ipv4ToInt(ip);
  const baseInt = ipv4ToInt(base);
  if (ipInt == null || baseInt == null) return false;
  if (prefix === 0) return true;
  const mask = prefix === 32 ? 0xffffffff : (~0 << (32 - prefix)) >>> 0;
  return (ipInt & mask) === (baseInt & mask);
}

export function isBlockedIp(ip) {
  if (!ip) return true;
  // Strip brackets/zone for IPv6.
  const cleaned = ip.replace(/^\[|\]$/g, '').split('%')[0];
  if (net.isIPv4(cleaned)) {
    return BLOCKED_V4.some(([base, prefix]) => inV4Range(cleaned, base, prefix));
  }
  if (net.isIPv6(cleaned)) {
    const lower = cleaned.toLowerCase();
    if (lower === '::1' || lower === '::') return true;
    return BLOCKED_V6_PREFIXES.some(p => lower.startsWith(p));
  }
  // Not a parseable IP — be conservative.
  return true;
}

export class SsrfBlockedError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SsrfBlockedError';
    this.status = 400;
  }
}

// Validate a URL against an allow-list policy and resolve its hostname,
// rejecting any address that lands in a private/internal range.
export async function assertSafeUrl(input, { allowedSchemes = ['http:', 'https:'] } = {}) {
  let url;
  try { url = new URL(input); } catch { throw new SsrfBlockedError('Invalid URL'); }
  if (!allowedSchemes.includes(url.protocol)) {
    throw new SsrfBlockedError(`Scheme ${url.protocol} is not allowed`);
  }
  // Reject userinfo (curl-style credentials) — too easy to abuse.
  if (url.username || url.password) {
    throw new SsrfBlockedError('URL credentials are not allowed');
  }
  const host = url.hostname;
  if (!host) throw new SsrfBlockedError('URL has no host');
  // IP literals — check directly.
  if (net.isIP(host)) {
    if (isBlockedIp(host)) throw new SsrfBlockedError(`Address ${host} is in a blocked range`);
    return { url, addresses: [host] };
  }
  // Names like "localhost" — explicitly reject.
  if (/^localhost$|\.local$|\.internal$/i.test(host)) {
    throw new SsrfBlockedError(`Hostname ${host} is not allowed`);
  }
  // Resolve A and AAAA, reject if any address is private.
  let addrs;
  try {
    addrs = await dns.lookup(host, { all: true });
  } catch (err) {
    throw new SsrfBlockedError(`DNS lookup failed for ${host}: ${err.message}`);
  }
  if (!addrs || !addrs.length) throw new SsrfBlockedError(`No DNS records for ${host}`);
  for (const a of addrs) {
    if (isBlockedIp(a.address)) {
      throw new SsrfBlockedError(`Address ${a.address} for ${host} is in a blocked range`);
    }
  }
  return { url, addresses: addrs.map(a => a.address) };
}

// Allow tests / dev to bypass the resolve-and-filter step (e.g. for 127.0.0.1
// in unit tests). NEVER set this in production.
export function ssrfBypassEnabled() {
  return process.env.SSRF_DISABLED === '1';
}

export async function safeFetch(input, init = {}) {
  if (!ssrfBypassEnabled()) {
    await assertSafeUrl(input);
  }
  return fetch(input, init);
}
