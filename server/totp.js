import crypto from 'crypto';

const RFC4648 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(buf) {
  let bits = 0;
  let value = 0;
  let out = '';
  for (let i = 0; i < buf.length; i++) {
    value = (value << 8) | buf[i];
    bits += 8;
    while (bits >= 5) {
      out += RFC4648[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += RFC4648[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(str) {
  const cleaned = String(str).toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const out = [];
  for (let i = 0; i < cleaned.length; i++) {
    const idx = RFC4648.indexOf(cleaned[i]);
    if (idx < 0) throw new Error('Invalid base32 character');
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export function generateSecret(bytes = 20) {
  return base32Encode(crypto.randomBytes(bytes));
}

export function hotp(secretBase32, counter, digits = 6) {
  const key = base32Decode(secretBase32);
  const buf = Buffer.alloc(8);
  // 64-bit big-endian counter
  let c = BigInt(counter);
  for (let i = 7; i >= 0; i--) {
    buf[i] = Number(c & 0xffn);
    c >>= 8n;
  }
  const hmac = crypto.createHmac('sha1', key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(code % 10 ** digits).padStart(digits, '0');
}

export function totp(secretBase32, { step = 30, digits = 6, t = Date.now() } = {}) {
  const counter = Math.floor(t / 1000 / step);
  return hotp(secretBase32, counter, digits);
}

// Verify a TOTP code, allowing for ±window steps of clock drift.
export function verifyTotp(secretBase32, code, { step = 30, digits = 6, window = 1, t = Date.now() } = {}) {
  if (typeof code !== 'string' || !/^\d{6}$/.test(code)) return false;
  const expected = code;
  const counter = Math.floor(t / 1000 / step);
  for (let i = -window; i <= window; i++) {
    const candidate = hotp(secretBase32, counter + i, digits);
    if (
      Buffer.byteLength(candidate) === Buffer.byteLength(expected) &&
      crypto.timingSafeEqual(Buffer.from(candidate), Buffer.from(expected))
    ) {
      return true;
    }
  }
  return false;
}

export function buildOtpAuthUrl({ issuer, account, secret, digits = 6, period = 30 }) {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: 'SHA1',
    digits: String(digits),
    period: String(period),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}
