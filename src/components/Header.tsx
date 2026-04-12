import { useState, useEffect } from 'react';
import { useApp } from '../store/AppContext';
import { PanelLeftClose, PanelLeft, Zap, Globe, Sun, Moon, BookOpen, Activity } from 'lucide-react';
import WelcomeGuide from './WelcomeGuide';
import HelpMenu from './HelpMenu';
import HealthDashboard from './HealthDashboard';

export default function Header() {
  const { state, dispatch } = useApp();
  const activeEnv = state.environments.find(e => e.id === state.activeEnvironmentId);
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
          {/* Health Dashboard */}
          <button
            onClick={() => setShowHealth(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-gray-500 hover:text-green-400 hover:bg-green-500/10 transition-colors text-xs"
            title="API Health Dashboard"
          >
            <Activity size={14} />
            <span className="hidden sm:inline">Health</span>
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
        </div>
      </header>

      {/* Welcome guide — shown on first launch */}
      {showGuide && (
        <WelcomeGuide onClose={() => setShowGuide(false)} />
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
    </>
  );
}
