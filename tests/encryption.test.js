import { describe, it, expect, beforeEach } from 'vitest';
import { encrypt, decrypt, isEncrypted, resetKeyCache } from '../server/encryption.js';

describe('encryption (AES-256-GCM)', () => {
  beforeEach(() => {
    process.env.APP_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    resetKeyCache();
  });

  it('encrypts and decrypts a string round-trip', () => {
    const ct = encrypt('super-secret-token');
    expect(ct).toMatch(/^v1:/);
    expect(decrypt(ct)).toBe('super-secret-token');
  });

  it('produces different ciphertexts for the same plaintext (random IV)', () => {
    const a = encrypt('same');
    const b = encrypt('same');
    expect(a).not.toBe(b);
    expect(decrypt(a)).toBe('same');
    expect(decrypt(b)).toBe('same');
  });

  it('detects tampering via auth tag', () => {
    const ct = encrypt('secret');
    const parts = ct.split(':');
    // Flip a bit in the data section
    const data = Buffer.from(parts[3], 'base64');
    data[0] ^= 0x01;
    const tampered = `${parts[0]}:${parts[1]}:${parts[2]}:${data.toString('base64')}`;
    expect(() => decrypt(tampered)).toThrow();
  });

  it('rejects ciphertext encrypted under a different key', () => {
    const ct = encrypt('hello');
    process.env.APP_ENCRYPTION_KEY = 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789';
    resetKeyCache();
    expect(() => decrypt(ct)).toThrow();
  });

  it('handles null/undefined gracefully', () => {
    expect(encrypt(null)).toBeNull();
    expect(decrypt(null)).toBeNull();
  });

  it('isEncrypted detects v1 ciphertexts', () => {
    expect(isEncrypted(encrypt('x'))).toBe(true);
    expect(isEncrypted('plaintext')).toBe(false);
    expect(isEncrypted('')).toBe(false);
  });
});
