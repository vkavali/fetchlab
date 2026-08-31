// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { apiUrl } from '../src/utils/apiBase';

describe('apiUrl', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('keeps same-origin API paths by default', () => {
    expect(apiUrl('/api/health')).toBe('/api/health');
  });

  it('prepends a configured API base URL', () => {
    localStorage.setItem('fetchlab_api_base_url', 'https://api.example.com/');
    expect(apiUrl('/api/auth/login')).toBe('https://api.example.com/api/auth/login');
  });

  it('does not rewrite external provider URLs', () => {
    expect(apiUrl('https://api.anthropic.com/v1/messages')).toBe('https://api.anthropic.com/v1/messages');
  });
});
