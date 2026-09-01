// @vitest-environment jsdom
import { webcrypto } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  decryptLocalJson,
  encryptLocalJson,
  loadEncryptedLocal,
  saveEncryptedLocal,
} from '../src/utils/localVault';

describe('local encrypted vault', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: webcrypto,
    });
    localStorage.clear();
  });

  it('round-trips JSON without storing the plaintext secret', async () => {
    const value = {
      name: 'Production agent',
      credentials: { api_key: 'sk-live-secret', authorization: 'Bearer secret' },
    };

    await saveEncryptedLocal('fetchlab:test:vault', value);

    const stored = localStorage.getItem('fetchlab:test:vault');
    expect(stored).toMatch(/^v1:/);
    expect(stored).not.toContain('sk-live-secret');
    expect(stored).not.toContain('Bearer secret');
    await expect(loadEncryptedLocal('fetchlab:test:vault', null)).resolves.toEqual(value);
  });

  it('rejects ciphertext tampering and binding the payload to another storage key', async () => {
    const payload = await encryptLocalJson('fetchlab:test:one', { token: 'sensitive' });
    const replacement = payload.endsWith('A') ? 'B' : 'A';
    const tampered = payload.slice(0, -1) + replacement;

    await expect(decryptLocalJson('fetchlab:test:one', tampered)).rejects.toThrow();
    await expect(decryptLocalJson('fetchlab:test:two', payload)).rejects.toThrow();
  });
});
