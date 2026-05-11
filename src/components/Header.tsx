import { useState, useEffect } from 'react';
import { useApp } from '../store/AppContext';
import { useAuth } from '../auth/AuthContext';
import { PanelLeftClose, PanelLeft, Zap, Globe, Sun, Moon, BookOpen, Activity, Plug, Wifi, Radio, GitBranch, Sparkles, LogOut, User as UserIcon, Users } from 'lucide-react';
import WelcomeGuide from './WelcomeGuide';
import HelpMenu from './HelpMenu';
import HealthDashboard from './HealthDashboard';
import Integrations from './Integrations';
import WebSocketTester from './WebSocketTester';
import SSEViewer from './SSEViewer';
import FlowBuilder from './FlowBuilder';
import AIRequestBuilder from './AIRequestBuilder';

export default function Header() {
  const { state, dispatch } = useApp();
  const { user, workspaces, activeWorkspaceId, setActiveWorkspaceId, logout, serverEnabled } = useAuth();
  const activeWs = workspaces.find(w => w.id === activeWorkspaceId);
  const activeEnv = state.environments.find(e => e.id === state.activeEnvironmentId);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [wsMenuOpen, setWsMenuOpen] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try { return (localStorage.getItem('fetchlab_theme') as 'dark' | 'light') || 'dark'; }
    catch { return 'dark'; }
  });
  const [showGuide, setShowGuide] = useState(() => {
    try { return !localStorage.getItem('fetchlab_onboarded'); }
    catch { return true; }
  });
  const [showHelp, setShowHelp] = useState(false);
  const [showHealth, setShowHealth] = useState(false);
  const [showIntegrations, setShowIntegrations] = useState(false);
  const [showWebSocket, setShowWebSocket] = useState(false);
  const [showSSE, setShowSSE] = useState(false);
  const [showFlow, setShowFlow] = useState(false);
  const [showAi, setShowAi] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle('light', theme === 'light');
    localStorage.setItem('fetchlab_theme', theme);
  }, [theme]);

  return (
    <>
      <header className="flex items-center justify-between px-4 h-11 bg-gray-900 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <button
            onClick={() => dispatch({ type: 'TOGGLE_SIDEBAR' })}
            className="p-1.5 rounded text-gray-500 hover:text-gray-200 hover:bg-gray-800"
            title={state.sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
          >
            {state.sidebarOpen ? <PanelLeftClose size={16} /> : <PanelLeft size={16} />}
          </button>

          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-[color:var(--color-accent)] flex items-center justify-center">
              <Zap size={11} className="text-black" strokeWidth={2.5} />
            </div>
            <span className="text-[13px] font-medium text-gray-100 tracking-tight">FetchLab</span>
            <span className="px-1.5 py-0.5 text-[9px] font-medium border border-gray-800 text-gray-500 uppercase tracking-wider">
              Beta
            </span>
          </div>
        </div>

        <div className="flex items-center gap-0.5">
          {/* AI Request Builder */}
          <button
            onClick={() => setShowAi(true)}
            className="flex items-center gap-1.5 px-2 h-7 rounded text-gray-400 hover:text-[color:var(--color-accent)] hover:bg-gray-800 text-[12px]"
            title="AI Request Builder — describe in natural language or paste cURL"
          >
            <Sparkles size={13} />
            <span className="hidden sm:inline">AI</span>
          </button>

          <button
            onClick={() => setShowWebSocket(true)}
            className="flex items-center gap-1.5 px-2 h-7 rounded text-gray-400 hover:text-gray-100 hover:bg-gray-800 text-[12px]"
            title="WebSocket Tester"
          >
            <Wifi size={13} />
            <span className="hidden sm:inline">WS</span>
          </button>

          <button
            onClick={() => setShowSSE(true)}
            className="flex items-center gap-1.5 px-2 h-7 rounded text-gray-400 hover:text-gray-100 hover:bg-gray-800 text-[12px]"
            title="SSE / Event Stream Viewer"
          >
            <Radio size={13} />
            <span className="hidden sm:inline">SSE</span>
          </button>

          <button
            onClick={() => setShowFlow(true)}
            className="flex items-center gap-1.5 px-2 h-7 rounded text-gray-400 hover:text-gray-100 hover:bg-gray-800 text-[12px]"
            title="Visual API Flow Builder"
          >
            <GitBranch size={13} />
            <span className="hidden sm:inline">Flow</span>
          </button>

          <button
            onClick={() => setShowHealth(true)}
            className="flex items-center gap-1.5 px-2 h-7 rounded text-gray-400 hover:text-gray-100 hover:bg-gray-800 text-[12px]"
            title="API Health Dashboard"
          >
            <Activity size={13} />
            <span className="hidden sm:inline">Health</span>
          </button>

          <button
            onClick={() => setShowIntegrations(true)}
            className="flex items-center gap-1.5 px-2 h-7 rounded text-gray-400 hover:text-gray-100 hover:bg-gray-800 text-[12px]"
            title="Slack, Teams & Embed integrations"
          >
            <Plug size={13} />
            <span className="hidden sm:inline">Integrate</span>
          </button>

          <button
            onClick={() => setShowHelp(true)}
            className="flex items-center gap-1.5 px-2 h-7 rounded text-gray-400 hover:text-gray-100 hover:bg-gray-800 text-[12px]"
            title="Help & Guide"
          >
            <BookOpen size={13} />
            <span className="hidden sm:inline">Help</span>
          </button>

          <div className="w-px h-4 bg-gray-800 mx-1.5" />

          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-1.5 rounded text-gray-400 hover:text-gray-100 hover:bg-gray-800"
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
          </button>

          {/* Environment selector */}
          <button
            onClick={() => dispatch({ type: 'SET_SIDEBAR_TAB', tab: 'environments' })}
            className="flex items-center gap-1.5 px-2 h-7 rounded text-[12px] text-gray-400 hover:text-gray-100 hover:bg-gray-800"
            title="Active environment"
          >
            <Globe size={12} />
            <span>{activeEnv ? activeEnv.name : 'No environment'}</span>
            {activeEnv && <div className="w-1.5 h-1.5 rounded-full bg-[color:var(--color-accent)]" />}
          </button>

          {/* Workspace switcher (when authed) */}
          {serverEnabled && user && workspaces.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setWsMenuOpen(o => !o)}
                className="flex items-center gap-1.5 px-2 h-7 rounded text-[12px] text-gray-400 hover:text-gray-100 hover:bg-gray-800"
                title="Switch workspace"
              >
                <Users size={12} />
                <span className="max-w-[120px] truncate">{activeWs ? activeWs.name : 'Workspace'}</span>
              </button>
              {wsMenuOpen && (
                <div className="absolute right-0 mt-1 w-56 bg-gray-900 border border-gray-800 rounded z-50 py-1">
                  {workspaces.map(w => (
                    <button
                      key={w.id}
                      onClick={() => { setActiveWorkspaceId(w.id); setWsMenuOpen(false); }}
                      className={`w-full text-left px-3 py-1.5 text-[12px] hover:bg-gray-800 ${w.id === activeWorkspaceId ? 'text-[color:var(--color-accent)]' : 'text-gray-300'}`}
                    >
                      {w.name}
                      <span className="ml-2 text-[10px] text-gray-600 uppercase">{w.member_role}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* User menu (when authed) */}
          {serverEnabled && user && (
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(o => !o)}
                className="flex items-center gap-1.5 px-2 h-7 rounded text-[12px] text-gray-400 hover:text-gray-100 hover:bg-gray-800"
                title={user.email}
              >
                <UserIcon size={12} />
                <span className="hidden md:inline max-w-[120px] truncate">{user.name || user.email}</span>
              </button>
              {userMenuOpen && (
                <div className="absolute right-0 mt-1 w-56 bg-gray-900 border border-gray-800 rounded z-50 py-1">
                  <div className="px-3 py-2 border-b border-gray-800">
                    <div className="text-[12px] font-medium text-gray-200 truncate">{user.name || user.email}</div>
                    <div className="text-[10px] text-gray-500 truncate">{user.email} · {user.role}</div>
                  </div>
                  <button
                    onClick={() => { setUserMenuOpen(false); logout(); }}
                    className="w-full text-left px-3 py-2 text-[12px] text-gray-300 hover:bg-gray-800 flex items-center gap-2"
                  >
                    <LogOut size={12} /> Sign out
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Welcome guide — shown on first launch */}
      {showGuide && (
        <WelcomeGuide onClose={() => setShowGuide(false)} />
      )}

      {/* Integrations */}
      {showIntegrations && (
        <Integrations onClose={() => setShowIntegrations(false)} />
      )}

      {/* Health Dashboard */}
      {showHealth && (
        <HealthDashboard onClose={() => setShowHealth(false)} />
      )}

      {/* Help menu */}
      {showHelp && (
        <HelpMenu
          onClose={() => setShowHelp(false)}
          onShowGuide={() => { setShowHelp(false); setShowGuide(true); }}
        />
      )}

      {/* WebSocket Tester */}
      {showWebSocket && (
        <WebSocketTester onClose={() => setShowWebSocket(false)} />
      )}

      {/* SSE Viewer */}
      {showSSE && (
        <SSEViewer onClose={() => setShowSSE(false)} />
      )}

      {/* Flow Builder */}
      {showFlow && (
        <FlowBuilder onClose={() => setShowFlow(false)} collections={state.collections} />
      )}

      {/* AI Request Builder */}
      {showAi && (
        <AIRequestBuilder onClose={() => setShowAi(false)} />
      )}
    </>
  );
}
