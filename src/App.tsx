import { useState, useCallback, useRef, useEffect } from 'react';
import { AppProvider } from './store/AppContext';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import TabBar from './components/TabBar';
import RequestBuilder from './components/RequestBuilder';
import ResponseViewer from './components/ResponseViewer';
import ResizeHandle from './components/ResizeHandle';
import { useApp } from './store/AppContext';

const SIDEBAR_MIN = 180;
const SIDEBAR_MAX = 500;
const SPLIT_MIN = 25;
const SPLIT_MAX = 75;

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

function AppLayout() {
  const { state, dispatch } = useApp();
  const [sidebarWidth, setSidebarWidth] = usePersistentNumber('fetchlab_sidebar_width', 256);
  const [splitPercent, setSplitPercent] = usePersistentNumber('fetchlab_split_percent', 50);
  const mainRef = useRef<HTMLDivElement>(null);

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

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-gray-100 overflow-hidden">
      <Header />
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

      {/* Footer status bar */}
      <footer className="flex items-center justify-between px-4 py-1 bg-gray-900/50 border-t border-gray-800 text-[10px] text-gray-600">
        <div className="flex items-center gap-3">
          <span>FetchLab v1.0.0</span>
          <span className="w-px h-3 bg-gray-800" />
          <span className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
            Ready
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span>Press Enter to send</span>
          <span>Ctrl+N for new tab</span>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppLayout />
    </AppProvider>
  );
}
