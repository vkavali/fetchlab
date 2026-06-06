import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import App from '../src/App';

class MockIntersectionObserver {
  private callback: IntersectionObserverCallback;

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
  }

  observe(target: Element) {
    this.callback([
      {
        isIntersecting: true,
        target,
      } as IntersectionObserverEntry,
    ], this as unknown as IntersectionObserver);
  }

  disconnect() {}
  unobserve() {}
  takeRecords() { return []; }
}

function renderAt(path: string) {
  window.history.pushState({}, '', path);
  return render(<App />);
}

describe('client route smoke', () => {
  beforeEach(() => {
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('renders the landing page', () => {
    renderAt('/');
    expect(screen.getByText('Your APIs broke at 2am.')).toBeTruthy();
    expect(screen.getAllByText('Start free').length).toBeGreaterThan(0);
    expect(document.body.textContent).not.toMatch(/[\u00e2\u00c2\u00c3\ufffd]/);
  });

  it('renders the download page', () => {
    renderAt('/download');
    expect(screen.getByText('Download FetchLab')).toBeTruthy();
    expect(screen.getByText('Windows Installer')).toBeTruthy();
  });

  it('renders the how-to page', () => {
    renderAt('/how-to');
    expect(screen.getByText('How to use FetchLab.')).toBeTruthy();
    expect(screen.getByText('Send an API request')).toBeTruthy();
    expect(screen.getByText('Configure authentication')).toBeTruthy();
  });

  it('renders the AI how-to page', () => {
    renderAt('/ai-how-to');
    expect(screen.getByText('How to use AI in FetchLab.')).toBeTruthy();
    expect(screen.getByText('What AI can and cannot do')).toBeTruthy();
    expect(screen.getByText('AI can assist with')).toBeTruthy();
    expect(screen.getByText('Human approval required')).toBeTruthy();
    expect(screen.getByText('Generate a request from plain English')).toBeTruthy();
    expect(screen.getByText('Use the AI Ops Agent for incident triage')).toBeTruthy();
  });

  it('renders legal pages', () => {
    const { unmount } = renderAt('/privacy');
    expect(screen.getByText('Privacy Policy')).toBeTruthy();
    unmount();

    renderAt('/terms');
    expect(screen.getByText('Terms of Service')).toBeTruthy();
  });

  it('renders the app shell', async () => {
    renderAt('/app');
    await waitFor(() => {
      expect(screen.getAllByText('New Request').length).toBeGreaterThan(0);
    });
    expect(screen.getByText('Send')).toBeTruthy();
  });
});
