// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import App from '../src/App';

class MockIntersectionObserver {
  observe() {}

  disconnect() {}
  unobserve() {}
  takeRecords() { return []; }
}

vi.mock('../src/utils/useCountry', async () => {
  const actual = await vi.importActual<typeof import('../src/utils/useCountry')>('../src/utils/useCountry');
  return {
    ...actual,
    useCountry: () => ({
      country: 'US',
      currency: 'USD',
      ready: true,
      setOverride: () => undefined,
      toggleCurrency: () => undefined,
    }),
  };
});

function renderAt(path: string) {
  window.history.pushState({}, '', path);
  return render(<App />);
}

describe('client route smoke', () => {
  beforeEach(() => {
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
    vi.stubGlobal('requestAnimationFrame', () => 0);
    vi.stubGlobal('cancelAnimationFrame', () => undefined);
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('renders the landing page', async () => {
    renderAt('/');
    expect(await screen.findByRole('heading', { level: 1, name: /The release gate for AI agents that take real actions/i })).toBeTruthy();
    expect(screen.getAllByText('Start free').length).toBeGreaterThan(0);
    expect(document.body.textContent).not.toMatch(/[\u00e2\u00c2\u00c3\ufffd]/);
  });

  it('renders the download page', async () => {
    renderAt('/download');
    expect(await screen.findByText('Download FetchLab')).toBeTruthy();
    expect(screen.getByText('Windows Installer')).toBeTruthy();
  });

  it('renders the how-to page', async () => {
    renderAt('/how-to');
    expect(await screen.findByText('How to use FetchLab.')).toBeTruthy();
    expect(screen.getByText('Send an API request')).toBeTruthy();
    expect(screen.getByText('Configure authentication')).toBeTruthy();
  });

  it('renders the AI how-to page', async () => {
    renderAt('/ai-how-to');
    expect(await screen.findByText('How to use AI in FetchLab.')).toBeTruthy();
    expect(screen.getByText('What AI can and cannot do')).toBeTruthy();
    expect(screen.getByText('AI can assist with')).toBeTruthy();
    expect(screen.getByText('Human approval required')).toBeTruthy();
    expect(screen.getByText('Generate a request from plain English')).toBeTruthy();
    expect(screen.getByText('Use the AI Ops Agent for incident triage')).toBeTruthy();
  });

  it('renders the enterprise page', async () => {
    renderAt('/enterprise');
    expect(await screen.findByRole('heading', { level: 1, name: 'Control what AI agents can do.' })).toBeTruthy();
    expect(screen.getByText('What teams get today')).toBeTruthy();
    expect(screen.getByText('How enterprise pilots run')).toBeTruthy();
  });

  it('renders legal pages', async () => {
    const { unmount } = renderAt('/privacy');
    expect(await screen.findByText('Privacy Policy')).toBeTruthy();
    unmount();

    renderAt('/terms');
    expect(await screen.findByText('Terms of Service')).toBeTruthy();
  });

  it('renders the app shell', async () => {
    renderAt('/app');
    await waitFor(() => {
      expect(screen.getAllByText('New Request').length).toBeGreaterThan(0);
    });
    expect(screen.getByText('Send')).toBeTruthy();
  });
});
