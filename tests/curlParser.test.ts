import { describe, it, expect } from 'vitest';
import { parseCurl } from '../src/utils/curlParser';

describe('parseCurl', () => {
  it('returns null for non-curl input', () => {
    expect(parseCurl('hello')).toBeNull();
    expect(parseCurl('')).toBeNull();
  });

  it('parses a simple GET', () => {
    const result = parseCurl(`curl https://api.example.com/users`);
    expect(result?.method).toBe('GET');
    expect(result?.url).toBe('https://api.example.com/users');
  });

  it('parses -X POST with -H and JSON -d', () => {
    const cmd = `curl -X POST https://api.example.com/posts -H "Content-Type: application/json" -d '{"title":"hi"}'`;
    const result = parseCurl(cmd);
    expect(result?.method).toBe('POST');
    expect(result?.url).toBe('https://api.example.com/posts');
    expect(result?.headers?.find(h => h.key === 'Content-Type')?.value).toBe('application/json');
    expect(result?.body?.type).toBe('json');
    expect(result?.body?.content).toBe('{"title":"hi"}');
  });

  it('handles --data-raw and falls back to POST when method missing', () => {
    const cmd = `curl https://api.example.com/x --data-raw 'foo=bar'`;
    const result = parseCurl(cmd);
    expect(result?.method).toBe('POST');
    expect(result?.body?.type).toBe('x-www-form-urlencoded');
  });

  it('handles backslash line continuations', () => {
    const cmd = `curl -X POST \\\n  https://api.example.com/x \\\n  -H "Authorization: Bearer xyz"`;
    const result = parseCurl(cmd);
    expect(result?.url).toBe('https://api.example.com/x');
    expect(result?.headers?.find(h => h.key === 'Authorization')?.value).toBe('Bearer xyz');
  });

  it('parses -u user:pass into basic auth', () => {
    const cmd = `curl -u alice:secret https://api.example.com/private`;
    const result = parseCurl(cmd);
    expect(result?.auth?.type).toBe('basic');
    expect(result?.auth?.basic?.username).toBe('alice');
    expect(result?.auth?.basic?.password).toBe('secret');
  });

  it('extracts query params from URL', () => {
    const cmd = `curl 'https://api.example.com/list?page=1&limit=20'`;
    const result = parseCurl(cmd);
    expect(result?.url).toBe('https://api.example.com/list');
    expect(result?.params?.find(p => p.key === 'page')?.value).toBe('1');
    expect(result?.params?.find(p => p.key === 'limit')?.value).toBe('20');
  });

  it('skips noise flags like --compressed -s -L', () => {
    const cmd = `curl --compressed -s -L https://api.example.com/x`;
    const result = parseCurl(cmd);
    expect(result?.url).toBe('https://api.example.com/x');
    expect(result?.method).toBe('GET');
  });

  it('parses -b cookie', () => {
    const cmd = `curl -b "session=xyz" https://api.example.com/me`;
    const result = parseCurl(cmd);
    expect(result?.headers?.find(h => h.key === 'Cookie')?.value).toBe('session=xyz');
  });
});
