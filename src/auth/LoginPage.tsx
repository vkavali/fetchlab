import { useEffect, useState } from 'react';
import { useAuth } from './AuthContext';

interface SsoConfig { id: string; name: string }

export default function LoginPage() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [ssoConfigs, setSsoConfigs] = useState<SsoConfig[]>([]);

  useEffect(() => {
    fetch('/api/auth/sso/configs').then(r => r.ok ? r.json() : { configs: [] })
      .then(d => setSsoConfigs(d.configs || []))
      .catch(() => { /* ignore */ });
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === 'login') await login(email, password);
      else await register(email, password, name);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0a0a] text-[#e5e5e5]">
      <main className="flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-[360px]">
          {/* Logo */}
          <div className="flex flex-col items-center mb-10">
            <div className="w-9 h-9 rounded bg-[#10b981] flex items-center justify-center mb-4">
              <span className="text-black text-base font-semibold">F</span>
            </div>
            <h1 className="text-[18px] font-medium text-white tracking-tight">FetchLab</h1>
            <p className="text-[12px] text-[#737373] mt-1">
              {mode === 'login' ? 'Sign in to your account' : 'Create your account'}
            </p>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-[#262626] mb-6">
            <button
              onClick={() => setMode('login')}
              className={`flex-1 pb-2.5 text-[12px] font-medium transition-colors border-b-2 -mb-px ${
                mode === 'login'
                  ? 'text-white border-[#10b981]'
                  : 'text-[#737373] border-transparent hover:text-[#e5e5e5]'
              }`}
            >
              Sign in
            </button>
            <button
              onClick={() => setMode('register')}
              className={`flex-1 pb-2.5 text-[12px] font-medium transition-colors border-b-2 -mb-px ${
                mode === 'register'
                  ? 'text-white border-[#10b981]'
                  : 'text-[#737373] border-transparent hover:text-[#e5e5e5]'
              }`}
            >
              Create account
            </button>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="text-[11px] text-[#a3a3a3] mb-1.5 block">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full h-9 px-3 bg-[#141414] border border-[#262626] rounded text-[13px] text-[#e5e5e5] outline-none focus:border-[#404040]"
                  placeholder="Jane Doe"
                />
              </div>
            )}

            <div>
              <label className="text-[11px] text-[#a3a3a3] mb-1.5 block">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full h-9 px-3 bg-[#141414] border border-[#262626] rounded text-[13px] text-[#e5e5e5] outline-none focus:border-[#404040]"
                placeholder="you@example.com"
                autoComplete="email"
              />
            </div>

            <div>
              <label className="text-[11px] text-[#a3a3a3] mb-1.5 block">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full h-9 px-3 bg-[#141414] border border-[#262626] rounded text-[13px] text-[#e5e5e5] outline-none focus:border-[#404040]"
                placeholder="••••••••"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                minLength={8}
              />
              {mode === 'register' && (
                <p className="text-[11px] text-[#525252] mt-1.5">8 characters minimum</p>
              )}
            </div>

            {error && (
              <div className="text-[12px] text-[#ef4444] bg-[rgba(239,68,68,0.06)] border border-[rgba(239,68,68,0.2)] rounded px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-9 bg-[#10b981] hover:bg-[#059669] disabled:opacity-50 disabled:cursor-not-allowed rounded text-[13px] font-medium text-black"
            >
              {loading ? 'Working…' : mode === 'login' ? 'Sign in' : 'Create account'}
            </button>
          </form>

          {ssoConfigs.length > 0 && (
            <>
              <div className="flex items-center gap-3 my-5">
                <div className="flex-1 h-px bg-[#262626]" />
                <span className="text-[10px] text-[#525252] uppercase tracking-wider">or</span>
                <div className="flex-1 h-px bg-[#262626]" />
              </div>
              <div className="space-y-2">
                {ssoConfigs.map(c => (
                  <a
                    key={c.id}
                    href={`/api/auth/sso/start/${c.id}`}
                    className="block w-full text-center h-9 leading-9 border border-[#262626] hover:border-[#404040] rounded text-[13px] text-[#e5e5e5]"
                  >
                    Continue with {c.name}
                  </a>
                ))}
              </div>
            </>
          )}

          <p className="text-[11px] text-[#525252] text-center mt-6">
            First account becomes admin. Your data stays on your server.
          </p>

          {mode === 'register' && (
            <p className="text-[11px] text-[#737373] text-center mt-4 leading-relaxed">
              By creating an account, you agree to our{' '}
              <a href="/terms" className="text-[#e5e5e5] hover:text-white underline underline-offset-2 decoration-[#404040]">
                Terms
              </a>{' '}
              and{' '}
              <a href="/privacy" className="text-[#e5e5e5] hover:text-white underline underline-offset-2 decoration-[#404040]">
                Privacy Policy
              </a>
              .
            </p>
          )}
        </div>
      </main>

      <footer className="border-t border-[#262626]">
        <div className="max-w-[360px] mx-auto px-6 py-4 flex items-center justify-between text-[11px] text-[#737373]">
          <span>© {new Date().getFullYear()} FetchLab</span>
          <nav className="flex items-center gap-4">
            <a href="/privacy" className="hover:text-[#e5e5e5]">Privacy</a>
            <a href="/terms" className="hover:text-[#e5e5e5]">Terms</a>
            <a href="mailto:vkavali10@gmail.com" className="hover:text-[#e5e5e5]">Contact</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
