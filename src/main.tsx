import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

function showFatalFallback(message: string) {
  const root = document.getElementById('root');
  if (!root || root.childElementCount > 0) return;
  root.innerHTML = `
    <div style="font-family:system-ui,Segoe UI,Roboto,sans-serif;background:#0a0a0f;color:#e5e7eb;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;">
      <div style="max-width:520px;width:100%;background:#111827;border:1px solid rgba(239,68,68,0.3);border-radius:14px;padding:24px;">
        <h2 style="margin:0 0 8px;font-size:18px;font-weight:700;color:#f87171;">FetchLab couldn't finish loading</h2>
        <p style="margin:0 0 12px;font-size:13px;color:#9ca3af;">Your saved data is safe in local storage. Try reloading the app.</p>
        <pre style="font-size:11px;color:#fca5a5;background:#0a0a0f;border:1px solid #1f2937;border-radius:6px;padding:8px;overflow:auto;max-height:160px;white-space:pre-wrap;">${escapeHtml(message)}</pre>
        <button onclick="window.location.reload()" style="margin-top:14px;width:100%;padding:10px;background:#2563eb;border:0;border-radius:6px;color:white;font-weight:600;font-size:13px;cursor:pointer;">Reload</button>
      </div>
    </div>
  `;
}

// Global handlers — last line of defense against a blank screen.
window.addEventListener('error', (e) => {
  // eslint-disable-next-line no-console
  console.error('[FetchLab fatal]', e.error || e.message);
  showFatalFallback(String(e.error?.message || e.message || 'Unknown error'));
});

window.addEventListener('unhandledrejection', (e) => {
  // eslint-disable-next-line no-console
  console.error('[FetchLab unhandled rejection]', e.reason);
  const reason = e.reason;
  const msg = reason instanceof Error ? reason.message : String(reason ?? 'Unknown rejection');
  showFatalFallback(msg);
});

try {
  const rootEl = document.getElementById('root');
  if (!rootEl) throw new Error('Root element #root not found in index.html');
  createRoot(rootEl).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  );
} catch (err) {
  showFatalFallback(err instanceof Error ? err.message : String(err));
}
