import { lazy, Suspense, useState, useEffect } from 'react';
import { useApp } from '../store/useApp';
import { useAuth } from '../auth/useAuth';
import { PanelLeftClose, PanelLeft, Globe, Sun, Moon, BookOpen, Activity, Plug, Wifi, Radio, GitBranch, LogOut, LogIn, User as UserIcon, Users, Scale, Shield, Cpu, Loader2 } from 'lucide-react';
import WelcomeGuide from './WelcomeGuide';
import { FetchLabLogo } from './FetchLabLogo';

const HelpMenu = lazy(() => import('./HelpMenu'));
const HealthDashboard = lazy(() => import('./HealthDashboard'));
const Integrations = lazy(() => import('./Integrations'));
const WebSocketTester = lazy(() => import('./WebSocketTester'));
const SSEViewer = lazy(() => import('./SSEViewer'));
const FlowBuilder = lazy(() => import('./FlowBuilder'));
const AIRequestBuilder = lazy(() => import('./AIRequestBuilder'));
const AgentDashboard = lazy(() => import('./AgentDashboard'));
const AIWorkbench = lazy(() => import('./AIWorkbench'));
const AutonomyLab = lazy(() => import('./AutonomyLab'));
const SecuritySettings = lazy(() => import('./SecuritySettings'));
const LLMSettings = lazy(() => import('./LLMSettings'));

function ToolLoading() {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center" style={{ background: 'var(--color-bg)' }}>
      <div role="status" aria-live="polite" className="flex items-center gap-3 text-sm" style={{ color: 'var(--color-text-muted)' }}>
        <Loader2 size={18} className="animate-spin" /> Loading tool
      </div>
    </div>
  );
}

export default function Header({ onSignIn }: { onSignIn?: () => void } = {}) {
  const { state, dispatch } = useApp();
  const { user, workspaces, activeWorkspaceId, setActiveWorkspaceId, logout } = useAuth();
  const isGuest = !user;
  const activeWs = workspaces.find(w => w.id === activeWorkspaceId);
  const activeEnv = state.environments.find(e => e.id === state.activeEnvironmentId);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [wsMenuOpen, setWsMenuOpen] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try {
      const saved = localStorage.getItem('fetchlab-theme') as 'dark' | 'light' | null;
      if (saved === 'dark' || saved === 'light') return saved;
      if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
        return 'dark';
      }
      return 'light';
    } catch { return 'light'; }
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
  const [showAIWorkbench, setShowAIWorkbench] = useState(false);
  const [showAutonomyLab, setShowAutonomyLab] = useState(false);
  const [showSecurity, setShowSecurity] = useState(false);
  const [showLlmSettings, setShowLlmSettings] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.classList.remove('light');
    localStorage.setItem('fetchlab-theme', theme);
  }, [theme]);

  return (
    <>
      <header
        className="flex items-center justify-between px-4 h-11"
        style={{ background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)' }}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={() => dispatch({ type: 'TOGGLE_SIDEBAR' })}
            className="p-1.5 rounded hover:bg-gray-800"
            style={{ color: 'var(--color-text-muted)' }}
            title={state.sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
          >
            {state.sidebarOpen ? <PanelLeftClose size={16} /> : <PanelLeft size={16} />}
          </button>

          <div className="flex items-center gap-2.5">
            <FetchLabLogo markSize={26} wordmarkSize={12} />
            <span
              className="font-mono"
              style={{
                padding: '2px 6px',
                fontSize: 9.5,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: 'var(--color-text-subtle)',
                border: '1px solid var(--color-border)',
                borderRadius: 3,
              }}
            >
              Beta
            </span>
          </div>
        </div>

        <div className="flex items-center gap-0.5" style={{ color: 'var(--color-text-muted)' }}>
          {/* Agent Change Gate */}
          <button
            onClick={() => setShowAutonomyLab(true)}
            className="flex items-center gap-2 px-3 h-8 rounded text-[13px] font-semibold hover:bg-[color:var(--color-surface-3)]"
            style={{
              color: 'var(--color-text)',
              border: '1px solid var(--color-border)',
              background: 'var(--color-accent-soft)',
            }}
            title="Review and enforce changes to an AI agent's actions"
          >
            <Scale size={15} style={{ color: 'var(--color-accent)' }} />
            <span className="hidden sm:inline">Agent Gate</span>
          </button>

          <button
            onClick={() => setShowWebSocket(true)}
            className="flex items-center gap-1.5 px-2 h-7 rounded text-[12px] hover:bg-[color:var(--color-surface-3)]"
            style={{ color: 'var(--color-text-muted)' }}
            title="WebSocket Tester"
          >
            <Wifi size={13} />
            <span className="hidden sm:inline">WS</span>
          </button>

          <button
            onClick={() => setShowSSE(true)}
            className="flex items-center gap-1.5 px-2 h-7 rounded text-[12px] hover:bg-[color:var(--color-surface-3)]"
            style={{ color: 'var(--color-text-muted)' }}
            title="SSE / Event Stream Viewer"
          >
            <Radio size={13} />
            <span className="hidden sm:inline">SSE</span>
          </button>

          <button
            onClick={() => setShowFlow(true)}
            className="flex items-center gap-1.5 px-2 h-7 rounded text-[12px] hover:bg-[color:var(--color-surface-3)]"
            style={{ color: 'var(--color-text-muted)' }}
            title="Visual API Flow Builder"
          >
            <GitBranch size={13} />
            <span className="hidden sm:inline">Flow</span>
          </button>

          <button
            onClick={() => setShowHealth(true)}
            className="flex items-center gap-1.5 px-2 h-7 rounded text-[12px] hover:bg-[color:var(--color-surface-3)]"
            style={{ color: 'var(--color-text-muted)' }}
            title="API Health Dashboard"
          >
            <Activity size={13} />
            <span className="hidden sm:inline">Health</span>
          </button>

          <button
            onClick={() => setShowIntegrations(true)}
            className="flex items-center gap-1.5 px-2 h-7 rounded text-[12px] hover:bg-[color:var(--color-surface-3)]"
            style={{ color: 'var(--color-text-muted)' }}
            title="Slack, Teams & Embed integrations"
          >
            <Plug size={13} />
            <span className="hidden sm:inline">Integrate</span>
          </button>

          <button
            onClick={() => setShowHelp(true)}
            className="flex items-center gap-1.5 px-2 h-7 rounded text-[12px] hover:bg-[color:var(--color-surface-3)]"
            style={{ color: 'var(--color-text-muted)' }}
            title="Help & Guide"
          >
            <BookOpen size={13} />
            <span className="hidden sm:inline">Help</span>
          </button>

          <div style={{ width: 1, height: 14, background: 'var(--color-border)', margin: '0 6px' }} />

          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-1.5 rounded hover:bg-[color:var(--color-surface-3)]"
            style={{ color: 'var(--color-text-muted)' }}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
          </button>

          {/* Environment selector - mono label, accent dot only when active */}
          <button
            onClick={() => dispatch({ type: 'SET_SIDEBAR_TAB', tab: 'environments' })}
            className="flex items-center gap-1.5 px-2 h-7 rounded text-[12px] hover:bg-[color:var(--color-surface-3)]"
            style={{ color: 'var(--color-text-muted)' }}
            title="Active environment"
          >
            <Globe size={12} />
            <span
              className="font-mono"
              style={{ fontSize: 10.5, letterSpacing: '0.12em', textTransform: 'uppercase' }}
            >
              {activeEnv ? activeEnv.name : 'No env'}
            </span>
            {activeEnv && (
              <span
                style={{
                  width: 6, height: 6, borderRadius: 999,
                  background: 'var(--color-accent)',
                  boxShadow: '0 0 0 2px color-mix(in oklch, var(--color-accent) 18%, transparent)',
                }}
              />
            )}
          </button>

          {/* Workspace switcher (when authed) */}
          {user && workspaces.length > 0 && (
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

          {/* Sign-in entry (guests only) - solid volt-teal, mirrors landing CTA */}
          {isGuest && onSignIn && (
            <button
              onClick={() => onSignIn()}
              className="flex items-center gap-1.5 px-3 h-7 text-[12px] font-semibold"
              style={{
                color: 'var(--color-accent-ink)',
                background: 'var(--color-accent)',
                borderRadius: 5,
                marginLeft: 6,
              }}
              title="Sign in or create an account"
            >
              <LogIn size={12} />
              <span className="hidden sm:inline">Sign in</span>
            </button>
          )}

          {/* User menu (when authed) */}
          {user && (
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
                    <div className="text-[10px] text-gray-500 truncate">{user.email} - {user.role}</div>
                    {user.totp_enabled && (
                      <div className="text-[9px] text-green-400 mt-1 flex items-center gap-1">
                        <Shield size={10} /> 2FA enabled
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => { setUserMenuOpen(false); setShowSecurity(true); }}
                    className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-gray-800 flex items-center gap-2"
                  >
                    <Shield size={12} /> Security &amp; sessions
                  </button>
                  <button
                    onClick={() => { setUserMenuOpen(false); setShowLlmSettings(true); }}
                    className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-gray-800 flex items-center gap-2"
                  >
                    <Cpu size={12} /> LLM Provider / BYOK
                  </button>
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

      <Suspense fallback={<ToolLoading />}>
        {/* Welcome guide - shown on first launch */}
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

      {/* Agent Change Gate */}
      {showAutonomyLab && (
        <AutonomyLab
          key={activeWorkspaceId || 'local'}
          onClose={() => setShowAutonomyLab(false)}
          onOpenAdvanced={() => { setShowAutonomyLab(false); setShowAIWorkbench(true); }}
          onOpenRequestBuilder={() => { setShowAutonomyLab(false); setShowAi(true); }}
        />
      )}
      {/* AI Workbench */}
      {showAIWorkbench && (
        <AIWorkbench
          onClose={() => setShowAIWorkbench(false)}
          onOpenAgent={() => { setShowAIWorkbench(false); setShowAgent(true); }}
          onOpenLlmSettings={() => { setShowAIWorkbench(false); setShowLlmSettings(true); }}
          onOpenSecurity={() => { setShowAIWorkbench(false); setShowSecurity(true); }}
          onOpenRequestBuilder={() => { setShowAIWorkbench(false); setShowAi(true); }}
        />
      )}

      {/* AI Ops Agent Dashboard */}
      {showAgent && (
        <AgentDashboard onClose={() => setShowAgent(false)} />
      )}

      {/* Security settings */}
      {showSecurity && (
        <SecuritySettings onClose={() => setShowSecurity(false)} />
      )}

      {/* LLM Settings / BYOK */}
        {showLlmSettings && (
          <LLMSettings onClose={() => setShowLlmSettings(false)} />
        )}
      </Suspense>
    </>
  );
}
