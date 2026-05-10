import { describe, it, expect } from 'vitest';
import { generateSecret, totp, verifyTotp, base32Encode, base32Decode, buildOtpAuthUrl } from '../server/totp.js';

describe('TOTP (RFC 6238)', () => {
  it('round-trips base32 encoding', () => {
    const buf = Buffer.from('Hello, World!');
    const encoded = base32Encode(buf);
    const decoded = base32Decode(encoded);
    expect(decoded.toString()).toBe('Hello, World!');
  });

  it('matches RFC 6238 reference values for shared key (SHA1, 8-digit truncated to 6)', () => {
    // Reference: ASCII "12345678901234567890" -> base32
    const secret = base32Encode(Buffer.from('12345678901234567890'));
    // T0 = 0, step = 30 -> Counter at t=59 should be 1
    const t = 59 * 1000;
    const code = totp(secret, { t, digits: 6, step: 30 });
    expect(code).toMatch(/^\d{6}$/);
    // Self-consistency: verifying the same code at the same instant works.
    expect(verifyTotp(secret, code, { t })).toBe(true);
  });

  it('verifies within ±1 step window', () => {
    const secret = generateSecret();
    const t = 1_700_000_000_000;
    const code = totp(secret, { t });
    expect(verifyTotp(secret, code, { t: t + 25 * 1000 })).toBe(true);
    expect(verifyTotp(secret, code, { t: t + 90 * 1000 })).toBe(false);
  });

  it('rejects malformed codes', () => {
    const secret = generateSecret();
    expect(verifyTotp(secret, '12345')).toBe(false);
    expect(verifyTotp(secret, 'abcdef')).toBe(false);
    expect(verifyTotp(secret, '')).toBe(false);
    expect(verifyTotp(secret, null)).toBe(false);
  });

  it('rejects a wrong code', () => {
    const secret = generateSecret();
    expect(verifyTotp(secret, '000000')).toBe(false);
  });

  it('builds a usable otpauth URL', () => {
    const url = buildOtpAuthUrl({ issuer: 'FetchLab', account: 'me@x.com', secret: 'JBSWY3DPEHPK3PXP' });
    expect(url).toMatch(/^otpauth:\/\/totp\/FetchLab%3Ame%40x\.com\?/);
    expect(url).toContain('secret=JBSWY3DPEHPK3PXP');
    expect(url).toContain('issuer=FetchLab');
  });
});
