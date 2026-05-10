import { useState, useEffect } from 'react';
import { useApp } from '../store/AppContext';
import { useAuth } from '../auth/AuthContext';
import { PanelLeftClose, PanelLeft, Zap, Globe, Sun, Moon, BookOpen, Activity, Plug, Wifi, Radio, GitBranch, Sparkles, LogOut, User as UserIcon, Users, Bot } from 'lucide-react';
import WelcomeGuide from './WelcomeGuide';
import HelpMenu from './HelpMenu';
import HealthDashboard from './HealthDashboard';
import Integrations from './Integrations';
import WebSocketTester from './WebSocketTester';
import SSEViewer from './SSEViewer';
import FlowBuilder from './FlowBuilder';
import AIRequestBuilder from './AIRequestBuilder';
import AgentDashboard from './AgentDashboard';

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
  const [showAgent, setShowAgent] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle('light', theme === 'light');
    localStorage.setItem('fetchlab_theme', theme);
  }, [theme]);

  return (
    <>
      <header className="flex items-center justify-between px-4 py-2 bg-gray-900/80 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <button
            onClick={() => dispatch({ type: 'TOGGLE_SIDEBAR' })}
            className="p-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors"
            title={state.sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
          >
            {state.sidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeft size={18} />}
          </button>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-500 to-accent-500 flex items-center justify-center shadow-lg shadow-brand-500/20">
                <Zap size={14} className="text-white" />
              </div>
              <span className="text-base font-bold bg-gradient-to-r from-brand-400 to-accent-400 bg-clip-text text-transparent">
                FetchLab
              </span>
            </div>
            <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-brand-500/20 text-brand-400 uppercase tracking-wider">
              Beta
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* AI Request Builder — prominent gradient button */}
          <button
            onClick={() => setShowAi(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-purple-500/15 to-pink-500/15 ring-1 ring-purple-500/30 text-purple-300 hover:text-white hover:from-purple-500 hover:to-pink-500 transition-all text-xs font-semibold"
            title="AI Request Builder — describe in natural language or paste cURL"
          >
            <Sparkles size={14} />
            <span className="hidden sm:inline">AI Builder</span>
          </button>

          {/* AI Ops Agent Dashboard */}
          <button
            onClick={() => setShowAgent(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-gray-500 hover:text-purple-400 hover:bg-purple-500/10 transition-colors text-xs"
            title="AI Ops Agent — monitors Slack, detects API issues, reproduces & diagnoses"
          >
            <Bot size={14} />
            <span className="hidden sm:inline">Agent</span>
          </button>

          {/* WebSocket Tester */}
          <button
            onClick={() => setShowWebSocket(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-gray-500 hover:text-blue-400 hover:bg-blue-500/10 transition-colors text-xs"
            title="WebSocket Tester"
          >
            <Wifi size={14} />
            <span className="hidden sm:inline">WS</span>
          </button>

          {/* SSE Viewer */}
          <button
            onClick={() => setShowSSE(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-gray-500 hover:text-orange-400 hover:bg-orange-500/10 transition-colors text-xs"
            title="SSE / Event Stream Viewer"
          >
            <Radio size={14} />
            <span className="hidden sm:inline">SSE</span>
          </button>

          {/* Flow Builder */}
          <button
            onClick={() => setShowFlow(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-gray-500 hover:text-cyan-400 hover:bg-cyan-500/10 transition-colors text-xs"
            title="Visual API Flow Builder"
          >
            <GitBranch size={14} />
            <span className="hidden sm:inline">Flow</span>
          </button>

          {/* Health Dashboard */}
          <button
            onClick={() => setShowHealth(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-gray-500 hover:text-green-400 hover:bg-green-500/10 transition-colors text-xs"
            title="API Health Dashboard"
          >
            <Activity size={14} />
            <span className="hidden sm:inline">Health</span>
          </button>

          {/* Integrations */}
          <button
            onClick={() => setShowIntegrations(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-gray-500 hover:text-accent-400 hover:bg-accent-500/10 transition-colors text-xs"
            title="Slack, Teams & Embed integrations"
          >
            <Plug size={14} />
            <span className="hidden sm:inline">Integrate</span>
          </button>

          {/* Help / Guide */}
          <button
            onClick={() => setShowHelp(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors text-xs"
            title="Help & Guide"
          >
            <BookOpen size={14} />
            <span className="hidden sm:inline">Help</span>
          </button>

          {/* Theme toggle */}
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors"
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          {/* Environment selector */}
          <button
            onClick={() => dispatch({ type: 'SET_SIDEBAR_TAB', tab: 'environments' })}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeEnv
                ? 'bg-green-500/10 text-green-400 hover:bg-green-500/15'
                : 'bg-gray-800/50 text-gray-500 hover:text-gray-300 hover:bg-gray-800'
            }`}
          >
            <Globe size={12} />
            {activeEnv ? activeEnv.name : 'No Environment'}
            {activeEnv && <div className="w-1.5 h-1.5 rounded-full bg-green-400" />}
          </button>

          {/* Workspace switcher (when authed) */}
          {serverEnabled && user && workspaces.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setWsMenuOpen(o => !o)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-purple-500/10 text-purple-400 hover:bg-purple-500/20"
                title="Switch workspace"
              >
                <Users size={12} />
                {activeWs ? activeWs.name : 'Workspace'}
              </button>
              {wsMenuOpen && (
                <div className="absolute right-0 mt-1 w-56 bg-gray-900 border border-gray-800 rounded-lg shadow-xl z-50 py-1">
                  {workspaces.map(w => (
                    <button
                      key={w.id}
                      onClick={() => { setActiveWorkspaceId(w.id); setWsMenuOpen(false); }}
                      className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-800 ${w.id === activeWorkspaceId ? 'text-purple-400' : 'text-gray-300'}`}
                    >
                      {w.name}
                      <span className="ml-2 text-[9px] text-gray-600 uppercase">{w.member_role}</span>
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
                className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs bg-gray-800/50 text-gray-300 hover:bg-gray-800"
                title={user.email}
              >
                <UserIcon size={12} />
                <span className="hidden md:inline max-w-[120px] truncate">{user.name || user.email}</span>
              </button>
              {userMenuOpen && (
                <div className="absolute right-0 mt-1 w-56 bg-gray-900 border border-gray-800 rounded-lg shadow-xl z-50 py-1">
                  <div className="px-3 py-2 border-b border-gray-800">
                    <div className="text-xs font-semibold text-gray-200 truncate">{user.name || user.email}</div>
                    <div className="text-[10px] text-gray-500 truncate">{user.email} · {user.role}</div>
                  </div>
                  <button
                    onClick={() => { setUserMenuOpen(false); logout(); }}
                    className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 flex items-center gap-2"
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

      {/* AI Ops Agent Dashboard */}
      {showAgent && (
        <AgentDashboard onClose={() => setShowAgent(false)} />
      )}
    </>
  );
}
