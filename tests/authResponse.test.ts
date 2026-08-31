import { describe, expect, it } from 'vitest';
import { parseAuthResponse } from '../src/auth/authResponse';

describe('parseAuthResponse', () => {
  it('preserves normal auth failures', async () => {
    const res = new Response(JSON.stringify({ error: 'Invalid email or password' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });

    await expect(parseAuthResponse(res, 'Login')).rejects.toThrow('Invalid email or password');
  });

  it('does not call API 500s server configuration failures', async () => {
    const res = new Response(JSON.stringify({ error: 'Login failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });

    await expect(parseAuthResponse(res, 'Login')).rejects.toThrow('Login failed - API server returned 500. Server said: Login failed');
  });

  it('reports missing API routes as a frontend/backend wiring issue', async () => {
    const res = new Response('<!doctype html><title>Frontend</title>', {
      status: 404,
      headers: { 'Content-Type': 'text/html' },
    });

    await expect(parseAuthResponse(res, 'Login')).rejects.toThrow('this page is not connected to the FetchLab API');
  });
});
