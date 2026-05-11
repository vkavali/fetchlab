import { describe, it, expect } from 'vitest';
import { isBlockedIp, assertSafeUrl, SsrfBlockedError } from '../server/ssrf.js';

describe('SSRF blocked-IP detection', () => {
  it('blocks the standard private and loopback ranges', () => {
    const blocked = [
      '127.0.0.1', '127.255.255.255',
      '10.0.0.1', '10.255.255.255',
      '172.16.0.1', '172.31.255.255',
      '192.168.1.1', '192.168.255.255',
      '169.254.169.254', // AWS instance metadata
      '0.0.0.0',
      '255.255.255.255',
      '224.0.0.1',         // multicast
      '::1', '::',
      'fe80::1', 'fc00::1', 'fd00::1',
      '::ffff:127.0.0.1',
    ];
    for (const ip of blocked) expect(isBlockedIp(ip), ip).toBe(true);
  });

  it('allows public addresses', () => {
    const allowed = ['8.8.8.8', '1.1.1.1', '93.184.216.34', '2606:4700:4700::1111'];
    for (const ip of allowed) expect(isBlockedIp(ip), ip).toBe(false);
  });
});

describe('assertSafeUrl', () => {
  it('rejects non-http(s) schemes', async () => {
    await expect(assertSafeUrl('file:///etc/passwd')).rejects.toThrow(SsrfBlockedError);
    await expect(assertSafeUrl('gopher://localhost')).rejects.toThrow(SsrfBlockedError);
    await expect(assertSafeUrl('javascript:alert(1)')).rejects.toThrow(SsrfBlockedError);
  });

  it('rejects URLs with embedded credentials', async () => {
    await expect(assertSafeUrl('https://user:pass@example.com')).rejects.toThrow(/credentials/);
  });

  it('rejects internal IP literals', async () => {
    await expect(assertSafeUrl('http://127.0.0.1/admin')).rejects.toThrow(/blocked/);
    await expect(assertSafeUrl('http://169.254.169.254/latest/meta-data')).rejects.toThrow(/blocked/);
    await expect(assertSafeUrl('http://[::1]/')).rejects.toThrow(/blocked/);
  });

  it('rejects "localhost" and friends by name', async () => {
    await expect(assertSafeUrl('http://localhost:8080/')).rejects.toThrow();
    await expect(assertSafeUrl('http://anything.local/')).rejects.toThrow();
    await expect(assertSafeUrl('http://service.internal/')).rejects.toThrow();
  });

  it('accepts a known public hostname', async () => {
    // example.com always resolves to public space
    const result = await assertSafeUrl('https://example.com/');
    expect(result.url.hostname).toBe('example.com');
    expect(result.addresses.length).toBeGreaterThan(0);
  });
});
