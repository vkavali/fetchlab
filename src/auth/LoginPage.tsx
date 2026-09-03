import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { FetchLabLogo } from '../components/FetchLabLogo';
import { usePublicLightTheme } from '../utils/usePublicLightTheme';
import { useAuth } from './useAuth';
import { apiUrl } from '../utils/apiBase';

interface SsoConfig { id: string; name: string }

interface LoginPageProps {
  initialMode?: 'login' | 'register';
  onCancel?: () => void;
}

export default function LoginPage({ initialMode = 'login', onCancel }: LoginPageProps = {}) {
  usePublicLightTheme();

  const { login, loginVerify2fa, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [ssoConfigs, setSsoConfigs] = useState<SsoConfig[]>([]);

  // 2FA state
  const [twoFaPending, setTwoFaPending] = useState<{ pending_token?: string } | null>(null);
  const [code, setCode] = useState('');
  const [useRecovery, setUseRecovery] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState('');

  useEffect(() => {
    fetch(apiUrl('/api/auth/sso/configs'), { credentials: 'include' }).then(r => r.ok ? r.json() : { configs: [] })
      .then(d => setSsoConfigs(d.configs || []))
      .catch(() => { /* ignore */ });
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === 'login') {
        const result = await login(email, password);
        if (result.twofa_required) {
          setTwoFaPending({ pending_token: result.pending_token });
        }
      } else {
        await register(email, password, name);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const onVerify2fa = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await loginVerify2fa(useRecovery
        ? { recovery_code: recoveryCode, pending_token: twoFaPending?.pending_token }
        : { code, pending_token: twoFaPending?.pending_token });
    } catch (err) {
      setError(err instanceof Error ? err.message : '2FA failed');
    } finally {
      setLoading(false);
    }
  };

  const cancel2fa = () => {
    setTwoFaPending(null);
    setCode('');
    setRecoveryCode('');
    setUseRecovery(false);
    setError(null);
  };

  if (twoFaPending) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] text-[#e5e5e5] px-6">
        <div className="w-full max-w-[400px]">
          {onCancel && (
            <button type="button" onClick={onCancel} className="mb-8 inline-flex items-center gap-2 text-sm text-[#a3a3a3] hover:text-white">
              <ArrowLeft size={16} /> Back to local workspace
            </button>
          )}
          <div className="flex flex-col items-center mb-8">
            <div className="mb-4">
              <FetchLabLogo markSize={42} showWordmark={false} />
            </div>
            <h1 className="text-xl font-semibold text-white">Two-factor authentication</h1>
            <p className="text-sm text-[#a3a3a3] mt-2 text-center">
              {useRecovery ? 'Enter one of your recovery codes' : 'Enter the 6-digit code from your authenticator app'}
            </p>
          </div>

          <form onSubmit={onVerify2fa} className="space-y-4">
            {!useRecovery ? (
              <div>
                <label className="text-sm text-[#d4d4d4] mb-2 block">Authentication code</label>
                <input
                  type="text" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required autoFocus
                  value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                  className="w-full h-11 px-3 bg-[#141414] border border-[#262626] rounded font-mono text-[18px] tracking-[0.4em] text-center text-[#e5e5e5] outline-none focus:border-[#404040]"
                  placeholder="123456"
                />
              </div>
            ) : (
              <div>
                <label className="text-sm text-[#d4d4d4] mb-2 block">Recovery code</label>
                <input
                  type="text" required autoFocus
                  value={recoveryCode} onChange={e => setRecoveryCode(e.target.value)}
                  className="w-full h-11 px-3 bg-[#141414] border border-[#404040] rounded font-mono text-sm text-[#e5e5e5] outline-none focus:border-[#10b981]"
                  placeholder="abcde-12345"
                />
              </div>
            )}
            {error && (
              <div className="text-sm text-[#f87171] bg-[rgba(239,68,68,0.06)] border border-[rgba(239,68,68,0.25)] rounded px-3 py-2.5">
                {error}
              </div>
            )}
            <button
              type="submit" disabled={loading}
              className="w-full h-11 bg-[#10b981] hover:bg-[#059669] disabled:opacity-50 disabled:cursor-not-allowed rounded text-sm font-semibold"
              style={{ color: '#fff' }}
            >
              {loading ? 'Verifying…' : 'Verify'}
            </button>
          </form>

          <div className="mt-5 flex justify-between text-sm">
            <button type="button" onClick={() => { setUseRecovery(v => !v); setError(null); }} className="text-[#a3a3a3] hover:text-[#e5e5e5]">
              {useRecovery ? 'Use authenticator app' : 'Use recovery code'}
            </button>
            <button type="button" onClick={cancel2fa} className="text-[#737373] hover:text-[#e5e5e5]">Cancel</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0a0a] text-[#e5e5e5]">
      <main className="flex-1 flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-[400px]">
          {onCancel && (
            <button type="button" onClick={onCancel} className="mb-8 inline-flex items-center gap-2 text-sm text-[#a3a3a3] hover:text-white">
              <ArrowLeft size={16} /> Back to local workspace
            </button>
          )}
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <FetchLabLogo markSize={42} wordmarkSize={16} />
            <h1 className="mt-5 text-2xl font-semibold text-white text-center">
              {mode === 'login' ? 'Sign in to FetchLab' : 'Create your FetchLab account'}
            </h1>
            <p className="text-sm text-[#a3a3a3] mt-2 text-center leading-5">
              {mode === 'login'
                ? 'Open your team workspace and continue your Product Missions.'
                : 'Connect GitHub and turn customer evidence into reviewed draft pull requests.'}
            </p>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-[#262626] mb-6">
            <button
              type="button"
              onClick={() => setMode('login')}
              className={`flex-1 pb-3 text-sm font-semibold transition-colors border-b-2 -mb-px ${
                mode === 'login'
                  ? 'text-white border-[#10b981]'
                  : 'text-[#737373] border-transparent hover:text-[#e5e5e5]'
              }`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => setMode('register')}
              className={`flex-1 pb-3 text-sm font-semibold transition-colors border-b-2 -mb-px ${
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
                <label className="text-sm text-[#d4d4d4] mb-2 block">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full h-11 px-3 bg-[#141414] border border-[#404040] rounded text-sm text-[#e5e5e5] outline-none focus:border-[#10b981]"
                  placeholder="Jane Doe"
                />
              </div>
            )}

            <div>
              <label className="text-sm text-[#d4d4d4] mb-2 block">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full h-11 px-3 bg-[#141414] border border-[#404040] rounded text-sm text-[#e5e5e5] outline-none focus:border-[#10b981]"
                placeholder="you@example.com"
                autoComplete="email"
              />
            </div>

            <div>
              <label className="text-sm text-[#d4d4d4] mb-2 block">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full h-11 px-3 bg-[#141414] border border-[#404040] rounded text-sm text-[#e5e5e5] outline-none focus:border-[#10b981]"
                placeholder="••••••••"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                minLength={8}
              />
              {mode === 'register' && (
                <p className="text-xs text-[#737373] mt-2">8 characters minimum</p>
              )}
            </div>

            {error && (
              <div className="text-sm text-[#f87171] bg-[rgba(239,68,68,0.06)] border border-[rgba(239,68,68,0.25)] rounded px-3 py-2.5">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-[#10b981] hover:bg-[#059669] disabled:opacity-50 disabled:cursor-not-allowed rounded text-sm font-semibold"
              style={{ color: '#fff' }}
            >
              {loading ? 'Working…' : mode === 'login' ? 'Sign in' : 'Create account'}
            </button>
          </form>

          {ssoConfigs.length > 0 && (
            <>
              <div className="flex items-center gap-3 my-5">
                <div className="flex-1 h-px bg-[#262626]" />
                <span className="text-xs text-[#737373] uppercase">or</span>
                <div className="flex-1 h-px bg-[#262626]" />
              </div>
              <div className="space-y-2">
                {ssoConfigs.map(c => (
                  <a
                    key={c.id}
                    href={apiUrl(`/api/auth/sso/start/${c.id}`)}
                    className="block w-full text-center h-11 leading-[44px] border border-[#404040] hover:border-[#737373] rounded text-sm text-[#e5e5e5]"
                  >
                    Continue with {c.name}
                  </a>
                ))}
              </div>
            </>
          )}

          <p className="text-xs text-[#737373] text-center mt-6">
            First account becomes admin. Your data stays on your server.
          </p>

          {mode === 'register' && (
            <p className="text-xs text-[#a3a3a3] text-center mt-4 leading-relaxed">
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
        <div className="max-w-[400px] mx-auto px-5 py-4 flex items-center justify-between text-xs text-[#737373]">
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
