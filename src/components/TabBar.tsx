import { useState } from 'react';
import { useApp } from '../store/AppContext';
import { Plus, X, Copy, Trash2, XCircle } from 'lucide-react';

export default function TabBar() {
  const { state, dispatch } = useApp();
  const { tabs, activeTabId } = state;
  const [contextMenu, setContextMenu] = useState<{ tabId: string; x: number; y: number } | null>(null);

  const handleContextMenu = (e: React.MouseEvent, tabId: string) => {
    e.preventDefault();
    setContextMenu({ tabId, x: e.clientX, y: e.clientY });
  };

  const closeOthers = (tabId: string) => {
    tabs.forEach(t => { if (t.id !== tabId) dispatch({ type: 'CLOSE_TAB', tabId: t.id }); });
    setContextMenu(null);
  };

  const closeToRight = (tabId: string) => {
    const idx = tabs.findIndex(t => t.id === tabId);
    tabs.slice(idx + 1).forEach(t => dispatch({ type: 'CLOSE_TAB', tabId: t.id }));
    setContextMenu(null);
  };

  return (
    <>
      <div
        className="flex items-center overflow-x-auto scrollbar-hide"
        style={{ background: 'var(--color-surface-2)', borderBottom: '1px solid var(--color-border)' }}
      >
        <div className="flex items-center flex-1 min-w-0">
          {tabs.map(tab => {
            const active = activeTabId === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => dispatch({ type: 'SET_ACTIVE_TAB', tabId: tab.id })}
                onContextMenu={e => handleContextMenu(e, tab.id)}
                className="group flex items-center gap-2 px-4 py-2.5 text-xs min-w-0 max-w-[220px] transition-colors relative"
                style={{
                  borderRight: '1px solid var(--color-border)',
                  background: active ? 'var(--color-surface)' : 'transparent',
                  color: active ? 'var(--color-text)' : 'var(--color-text-muted)',
                  fontWeight: active ? 500 : 400,
                }}
              >
                <span
                  className={`font-mono method-${tab.method.toLowerCase()}`}
                  style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.06em' }}
                >
                  {tab.method}
                </span>
                <span className="truncate">{tab.name || 'New Request'}</span>
                {tab.isDirty && (
                  <span
                    className="flex-shrink-0"
                    style={{
                      width: 6, height: 6, borderRadius: 999,
                      background: 'var(--color-warning)',
                    }}
                  />
                )}
                <button
                  onClick={e => { e.stopPropagation(); dispatch({ type: 'CLOSE_TAB', tabId: tab.id }); }}
                  className="p-0.5 rounded opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
                  style={{ color: 'var(--color-text-subtle)' }}
                >
                  <X size={12} />
                </button>
                {/* Active underline — orange hairline that slides in */}
                <span
                  aria-hidden
                  style={{
                    position: 'absolute',
                    left: 0, right: 0, bottom: -1,
                    height: 2,
                    background: 'var(--color-accent)',
                    transform: active ? 'scaleX(1)' : 'scaleX(0)',
                    transformOrigin: 'center',
                    transition: 'transform 280ms cubic-bezier(0.22, 1, 0.36, 1)',
                  }}
                />
              </button>
            );
          })}
        </div>
        <button
          onClick={() => dispatch({ type: 'NEW_TAB' })}
          className="flex-shrink-0 p-2.5 transition-colors hover:bg-[color:var(--color-surface-3)]"
          style={{ color: 'var(--color-text-muted)' }}
          title="New Tab (Ctrl+N)"
        >
          <Plus size={16} />
        </button>
      </div>

      {/* Right-click context menu */}
      {contextMenu && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setContextMenu(null)} />
          <div
            className="fixed z-40 bg-gray-800 border border-gray-700 rounded-lg shadow-2xl py-1 min-w-[180px] animate-slide-in"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <button
              onClick={() => { dispatch({ type: 'DUPLICATE_TAB', tabId: contextMenu.tabId }); setContextMenu(null); }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs text-gray-300 hover:bg-gray-700/50"
            >
              <Copy size={12} /> Duplicate Tab
            </button>
            <div className="border-t border-gray-700 my-1" />
            <button
              onClick={() => { dispatch({ type: 'CLOSE_TAB', tabId: contextMenu.tabId }); setContextMenu(null); }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs text-gray-300 hover:bg-gray-700/50"
            >
              <X size={12} /> Close
            </button>
            <button
              onClick={() => closeOthers(contextMenu.tabId)}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs text-gray-300 hover:bg-gray-700/50"
            >
              <XCircle size={12} /> Close Others
            </button>
            <button
              onClick={() => closeToRight(contextMenu.tabId)}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs text-gray-300 hover:bg-gray-700/50"
            >
              <Trash2 size={12} /> Close to Right
            </button>
          </div>
        </>
      )}
    </>
  );
}
