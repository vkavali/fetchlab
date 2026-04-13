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
      <div className="flex items-center bg-gray-900/80 border-b border-gray-800 overflow-x-auto scrollbar-hide">
        <div className="flex items-center flex-1 min-w-0">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => dispatch({ type: 'SET_ACTIVE_TAB', tabId: tab.id })}
              onContextMenu={e => handleContextMenu(e, tab.id)}
              className={`group flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-r border-gray-800 min-w-0 max-w-[200px] transition-colors ${
                activeTabId === tab.id
                  ? 'bg-gray-950 text-gray-100 border-b-2 border-b-brand-500'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/50'
              }`}
            >
              <span className={`font-mono font-bold text-[10px] method-${tab.method.toLowerCase()}`}>
                {tab.method}
              </span>
              <span className="truncate">{tab.name || 'New Request'}</span>
              {tab.isDirty && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />}
              <button
                onClick={e => { e.stopPropagation(); dispatch({ type: 'CLOSE_TAB', tabId: tab.id }); }}
                className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-gray-700 text-gray-500 hover:text-gray-200 transition-all flex-shrink-0"
              >
                <X size={12} />
              </button>
            </button>
          ))}
        </div>
        <button
          onClick={() => dispatch({ type: 'NEW_TAB' })}
          className="flex-shrink-0 p-2.5 text-gray-500 hover:text-gray-300 hover:bg-gray-800/50 transition-colors"
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
