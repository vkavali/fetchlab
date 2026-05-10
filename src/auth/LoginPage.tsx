import { useEffect, useState } from 'react';
import { useAuth } from './AuthContext';

interface SsoConfig { id: string; name: string }

interface LoginPageProps {
  trialEnded?: boolean;
  initialMode?: 'login' | 'register';
}

export default function LoginPage({ trialEnded = false, initialMode = 'login' }: LoginPageProps = {}) {
  const { login, loginVerify2fa, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>(trialEnded ? 'register' : initialMode);
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
    fetch('/api/auth/sso/configs').then(r => r.ok ? r.json() : { configs: [] })
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
      <div className="flex flex-col items-center justify-center h-screen bg-gray-950 text-gray-100 p-4">
        <div className="w-full max-w-sm bg-gray-900 rounded-xl border border-gray-800 p-6 shadow-xl">
          <h1 className="text-xl font-bold mb-1 text-center">Two-factor authentication</h1>
          <p className="text-xs text-gray-500 text-center mb-6">
            {useRecovery ? 'Enter one of your recovery codes' : 'Enter the 6-digit code from your authenticator app'}
          </p>
          <form onSubmit={onVerify2fa} className="space-y-3">
            {!useRecovery ? (
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Authentication code</label>
                <input
                  type="text" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required autoFocus
                  value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                  className="w-full px-3 py-2 bg-gray-950 border border-gray-800 rounded text-lg font-mono tracking-[0.5em] text-center focus:border-blue-500 outline-none"
                  placeholder="123456"
                />
              </div>
            ) : (
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Recovery code</label>
                <input
                  type="text" required autoFocus
                  value={recoveryCode} onChange={e => setRecoveryCode(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-950 border border-gray-800 rounded text-sm font-mono focus:border-blue-500 outline-none"
                  placeholder="abcde-12345"
                />
              </div>
            )}
            {error && (
              <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded p-2">{error}</div>
            )}
            <button
              type="submit" disabled={loading}
              className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded text-sm font-semibold"
            >
              {loading ? 'Verifying…' : 'Verify'}
            </button>
          </form>
          <div className="mt-4 flex justify-between text-xs">
            <button type="button" onClick={() => { setUseRecovery(v => !v); setError(null); }} className="text-gray-400 hover:text-gray-200">
              {useRecovery ? 'Use authenticator app' : 'Use recovery code'}
            </button>
            <button type="button" onClick={cancel2fa} className="text-gray-500 hover:text-gray-300">Cancel</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-950 text-gray-100 p-4">
      <div className="w-full max-w-sm bg-gray-900 rounded-xl border border-gray-800 p-6 shadow-xl">
        <h1 className="text-2xl font-bold mb-1 text-center">🧪 FetchLab</h1>
        <p className="text-xs text-gray-500 text-center mb-6">Enterprise API testing</p>

        {trialEnded && (
          <div className="mb-4 p-3 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs">
            Your trial has ended. Create a free account to continue.
          </div>
        )}

        <div className="flex gap-1 mb-4 bg-gray-950 rounded-md p-1">
          <button
            onClick={() => setMode('login')}
            className={`flex-1 py-1.5 text-sm rounded ${mode === 'login' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}
          >Login</button>
          <button
            onClick={() => setMode('register')}
            className={`flex-1 py-1.5 text-sm rounded ${mode === 'register' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}
          >Register</button>
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          {mode === 'register' && (
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Name</label>
              <input
                type="text" value={name} onChange={e => setName(e.target.value)}
                className="w-full px-3 py-2 bg-gray-950 border border-gray-800 rounded text-sm focus:border-blue-500 outline-none"
                placeholder="Jane Doe"
              />
            </div>
          )}
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Email</label>
            <input
              type="email" required value={email} onChange={e => setEmail(e.target.value)}
              className="w-full px-3 py-2 bg-gray-950 border border-gray-800 rounded text-sm focus:border-blue-500 outline-none"
              placeholder="you@example.com"
              autoComplete="email"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Password</label>
            <input
              type="password" required value={password} onChange={e => setPassword(e.target.value)}
              className="w-full px-3 py-2 bg-gray-950 border border-gray-800 rounded text-sm focus:border-blue-500 outline-none"
              placeholder="••••••••"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              minLength={8}
            />
            {mode === 'register' && <p className="text-[10px] text-gray-600 mt-1">8+ characters</p>}
          </div>

          {error && (
            <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded p-2">{error}</div>
          )}

          <button
            type="submit" disabled={loading}
            className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded text-sm font-semibold"
          >
            {loading ? 'Working…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        {ssoConfigs.length > 0 && (
          <>
            <div className="flex items-center gap-2 my-4">
              <div className="flex-1 h-px bg-gray-800" />
              <span className="text-[10px] text-gray-600 uppercase">or</span>
              <div className="flex-1 h-px bg-gray-800" />
            </div>
            <div className="space-y-2">
              {ssoConfigs.map(c => (
                <a
                  key={c.id} href={`/api/auth/sso/start/${c.id}`}
                  className="block w-full text-center py-2 border border-gray-800 hover:border-gray-700 rounded text-sm"
                >Continue with {c.name}</a>
              ))}
            </div>
          </>
        )}

        <p className="text-[10px] text-gray-600 text-center mt-6">
          First account becomes admin. No data leaves your server.
        </p>
      </div>
    </div>
  );
}
