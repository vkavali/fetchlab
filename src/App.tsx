import { lazy, Suspense, useState, useCallback, useRef, useEffect } from 'react';
import { AppProvider } from './store/AppContext';
import { useApp } from './store/useApp';
import { AuthProvider } from './auth/AuthContext';
import { useAuth } from './auth/useAuth';
import LoginPage from './auth/LoginPage';
import TrialBanner from './auth/TrialBanner';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import TabBar from './components/TabBar';
import RequestBuilder from './components/RequestBuilder';
import ResponseViewer from './components/ResponseViewer';
import ResizeHandle from './components/ResizeHandle';
import { extractSharedData, clearShareHash } from './utils/shareLink';
import { generateId } from './utils/helpers';
import type { Collection, RequestConfig } from './types';
import ErrorBoundary from './components/ErrorBoundary';

const Landing = lazy(() => import('./pages/Landing'));
const Pricing = lazy(() => import('./pages/Pricing'));
const Download = lazy(() => import('./pages/Download'));
const HowTo = lazy(() => import('./pages/HowTo'));
const AIHowTo = lazy(() => import('./pages/AIHowTo'));
const Enterprise = lazy(() => import('./pages/Enterprise'));
const PrivacyPolicy = lazy(() => import('./components/legal/PrivacyPolicy'));
const TermsOfService = lazy(() => import('./components/legal/TermsOfService'));

const SIDEBAR_MIN = 180;
const SIDEBAR_MAX = 500;
const SPLIT_MIN = 25;
const SPLIT_MAX = 75;

function PublicPage({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <Suspense
        fallback={(
          <div role="status" aria-live="polite" className="min-h-screen flex items-center justify-center" style={{ background: 'var(--color-bg)', color: 'var(--color-text-muted)' }}>
            Loading FetchLab
          </div>
        )}
      >
        {children}
      </Suspense>
    </ErrorBoundary>
  );
}

function usePersistentNumber(key: string, defaultValue: number): [number, (v: number | ((prev: number) => number)) => void] {
  const [value, setValue] = useState(() => {
    try {
      const saved = localStorage.getItem(key);
      if (saved !== null) return parseFloat(saved);
    } catch { /* ignore */ }
    return defaultValue;
  });

  const setAndPersist = useCallback((v: number | ((prev: number) => number)) => {
    setValue(prev => {
      const next = typeof v === 'function' ? v(prev) : v;
      try { localStorage.setItem(key, String(next)); } catch { /* ignore */ }
      return next;
    });
  }, [key]);

  return [value, setAndPersist];
}

function AppLayout({ onSignUp }: { onSignUp?: () => void } = {}) {
  const { state, dispatch } = useApp();
  const { user, trialDaysRemaining } = useAuth();
  const [sidebarWidth, setSidebarWidth] = usePersistentNumber('fetchlab_sidebar_width', 256);
  const [splitPercent, setSplitPercent] = usePersistentNumber('fetchlab_split_percent', 50);
  const mainRef = useRef<HTMLDivElement>(null);
  const showTrialBanner = !user;

  const handleSidebarResize = useCallback((delta: number) => {
    setSidebarWidth(prev => Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, prev + delta)));
  }, [setSidebarWidth]);

  const handleSplitResize = useCallback((delta: number) => {
    if (!mainRef.current) return;
    const totalWidth = mainRef.current.offsetWidth;
    const deltaPercent = (delta / totalWidth) * 100;
    setSplitPercent(prev => Math.min(SPLIT_MAX, Math.max(SPLIT_MIN, prev + deltaPercent)));
  }, [setSplitPercent]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;
      if (isMod && e.key === 'n') {
        e.preventDefault();
        dispatch({ type: 'NEW_TAB' });
      } else if (isMod && e.key === 'w') {
        e.preventDefault();
        if (state.activeTabId) dispatch({ type: 'CLOSE_TAB', tabId: state.activeTabId });
      } else if (isMod && e.key === '/') {
        e.preventDefault();
        dispatch({ type: 'TOGGLE_SIDEBAR' });
      } else if (isMod && e.key === 'l') {
        e.preventDefault();
        const urlInput = document.querySelector<HTMLInputElement>('input[placeholder*="URL"]');
        urlInput?.focus();
        urlInput?.select();
      } else if (isMod && e.key >= '1' && e.key <= '9') {
        e.preventDefault();
        const idx = parseInt(e.key) - 1;
        if (idx < state.tabs.length) {
          dispatch({ type: 'SET_ACTIVE_TAB', tabId: state.tabs[idx].id });
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [state.activeTabId, state.tabs, dispatch]);

  // Handle share link import on page load
  const [shareImport, setShareImport] = useState<{ type: string; name: string } | null>(null);
  useEffect(() => {
    const shared = extractSharedData();
    if (!shared) return;
    let showTimer: ReturnType<typeof setTimeout> | undefined;
    let hideTimer: ReturnType<typeof setTimeout> | undefined;

    const showImport = (nextImport: { type: string; name: string }) => {
      clearShareHash();
      showTimer = setTimeout(() => {
        setShareImport(nextImport);
        hideTimer = setTimeout(() => setShareImport(null), 5000);
      }, 0);
    };

    const data = shared.data as Record<string, unknown>;
    if (shared.type === 'collection' && data.name && Array.isArray(data.requests)) {
      const col: Collection = {
        id: generateId(),
        name: data.name as string,
        description: (data.description as string) || '',
        requests: (data.requests as RequestConfig[]).map((r: RequestConfig) => ({ ...r, id: generateId() })),
      };
      dispatch({ type: 'ADD_COLLECTION', collection: col });
      showImport({ type: 'collection', name: col.name });
    } else if (shared.type === 'request' && data.name) {
      dispatch({ type: 'OPEN_REQUEST', request: data as unknown as RequestConfig });
      showImport({ type: 'request', name: data.name as string });
    }

    return () => {
      if (showTimer) clearTimeout(showTimer);
      if (hideTimer) clearTimeout(hideTimer);
    };
  }, [dispatch]);

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-gray-100 overflow-hidden">
      {showTrialBanner && (
        <TrialBanner daysRemaining={trialDaysRemaining} onSignUp={() => onSignUp?.()} />
      )}
      <Header onSignIn={onSignUp} />

      {/* Share import toast */}
      {shareImport && (
        <div className="flex items-center justify-center gap-2 px-4 py-2 bg-green-500/10 border-b border-green-500/20 text-green-400 text-xs animate-slide-in">
          <span>✓ Imported {shareImport.type}: <strong>{shareImport.name}</strong></span>
          <button onClick={() => setShareImport(null)} className="text-green-500/50 hover:text-green-400 ml-2">✕</button>
        </div>
      )}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        {state.sidebarOpen && (
          <>
            <div className="flex-shrink-0 overflow-hidden" style={{ width: sidebarWidth }}>
              <Sidebar />
            </div>
            <ResizeHandle direction="horizontal" onResize={handleSidebarResize} />
          </>
        )}

        {/* Main content */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <TabBar />
          <div ref={mainRef} className="flex-1 flex overflow-hidden">
            {/* Request panel */}
            <div
              className="flex flex-col overflow-hidden border-r border-gray-800 min-w-0"
              style={{ width: `${splitPercent}%` }}
            >
              <RequestBuilder />
            </div>

            <ResizeHandle direction="horizontal" onResize={handleSplitResize} />

            {/* Response panel */}
            <div
              className="flex flex-col overflow-hidden min-w-0"
              style={{ width: `${100 - splitPercent}%` }}
            >
              <ResponseViewer />
            </div>
          </div>
        </div>
      </div>

      {/* Footer status bar — instrument-grade nameplate */}
      <footer
        className="flex items-center justify-between px-4 py-1.5"
        style={{
          background: 'var(--color-surface-2)',
          borderTop: '1px solid var(--color-border)',
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: 'var(--color-text-subtle)',
        }}
      >
        <div className="flex items-center gap-3">
          <span style={{ color: 'var(--color-text-muted)' }}>FetchLab v1.2.0</span>
          <span style={{ width: 1, height: 10, background: 'var(--color-border-strong)' }} />
          <span className="flex items-center gap-1.5">
            <span
              style={{
                width: 6, height: 6, borderRadius: 999,
                background: 'var(--color-accent)',
                boxShadow: '0 0 0 2px color-mix(in oklch, var(--color-accent) 18%, transparent)',
              }}
            />
            Ready
          </span>
          <span style={{ width: 1, height: 10, background: 'var(--color-border-strong)' }} />
          <span>Local-first · BYOK</span>
        </div>
        <div className="flex items-center gap-3">
          <span>Enter · Send</span>
          <span style={{ width: 1, height: 10, background: 'var(--color-border-strong)' }} />
          <span>Ctrl+N · New tab</span>
          <span style={{ width: 1, height: 10, background: 'var(--color-border-strong)' }} />
          <span>Ctrl+L · Focus URL</span>
        </div>
      </footer>
    </div>
  );
}

function AuthGate({ children }: { children: (opts: { onSignUp: () => void }) => React.ReactNode }) {
  const { user, loading, trialEnded } = useAuth();
  const [forceLogin, setForceLogin] = useState<null | 'login' | 'register'>(null);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-950 text-gray-400 text-sm">
        Loading…
      </div>
    );
  }

  if (user) {
    return <>{children({ onSignUp: () => setForceLogin('register') })}</>;
  }

  if (trialEnded) {
    return <LoginPage trialEnded initialMode="register" />;
  }

  if (forceLogin) {
    return <LoginPage initialMode={forceLogin} />;
  }

  return <>{children({ onSignUp: () => setForceLogin('register') })}</>;
}

function useCurrentPath() {
  const [path, setPath] = useState(() => window.location.pathname);
  useEffect(() => {
    const onChange = () => setPath(window.location.pathname);
    window.addEventListener('popstate', onChange);
    return () => window.removeEventListener('popstate', onChange);
  }, []);
  return path;
}

const isTauri = (() => {
  try {
    return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
  } catch {
    return false;
  }
})();

export default function App() {
  try {
    const path = useCurrentPath();

    if (!isTauri) {
      if (path === '/' || path === '') return <PublicPage><Landing /></PublicPage>;
      if (path === '/how-to') return <PublicPage><HowTo /></PublicPage>;
      if (path === '/ai-how-to') return <PublicPage><AIHowTo /></PublicPage>;
      if (path === '/enterprise') return <PublicPage><Enterprise /></PublicPage>;
      if (path === '/pricing') return <PublicPage><Pricing /></PublicPage>;
      if (path === '/download') return <PublicPage><Download /></PublicPage>;
      if (path === '/privacy') return <PublicPage><PrivacyPolicy /></PublicPage>;
      if (path === '/terms') return <PublicPage><TermsOfService /></PublicPage>;
    }

    return (
      <ErrorBoundary>
        <AuthProvider>
          <AuthGate>
            {({ onSignUp }) => (
              <ErrorBoundary>
                <AppProvider>
                  <AppLayout onSignUp={onSignUp} />
                </AppProvider>
              </ErrorBoundary>
            )}
          </AuthGate>
        </AuthProvider>
      </ErrorBoundary>
    );
  } catch (err) {
    console.error('[App] render error', err);
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-950 text-gray-100 p-4">
        <div className="max-w-md w-full bg-gray-900 border border-red-500/30 rounded-xl p-6">
          <h2 className="text-lg font-bold mb-2">FetchLab failed to start</h2>
          <p className="text-sm text-gray-400 mb-3">{err instanceof Error ? err.message : String(err)}</p>
          <button
            onClick={() => window.location.reload()}
            className="w-full py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm font-semibold"
          >Reload</button>
        </div>
      </div>
    );
  }
}
