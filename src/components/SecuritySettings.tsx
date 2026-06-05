import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Shield, ShieldCheck, KeyRound, Monitor, X, Check, AlertTriangle, RefreshCw, LogOut } from 'lucide-react';
import { useAuth } from '../auth/useAuth';
import { authJson } from '../utils/apiClient';

interface SessionRow {
  id: string;
  user_agent: string | null;
  ip: string | null;
  created_at: string;
  expires_at: string;
  rotated_at: string | null;
  revoked_at: string | null;
  reuse_detected: boolean;
  is_current: boolean;
}

interface Props { onClose: () => void }

export default function SecuritySettings({ onClose }: Props) {
  const { user, refresh } = useAuth();
  const [tab, setTab] = useState<'2fa' | 'sessions'>('2fa');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-[720px] max-w-[95vw] max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <Shield size={18} className="text-blue-400" />
            <div>
              <h2 className="text-sm font-semibold">Security settings</h2>
              <p className="text-[10px] text-gray-500">{user?.email}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-500 hover:text-gray-300">
            <X size={16} />
          </button>
        </div>

        <div className="flex border-b border-gray-800">
          <button
            onClick={() => setTab('2fa')}
            className={`px-4 py-2 text-xs font-medium border-b-2 ${tab === '2fa' ? 'text-blue-400 border-blue-400' : 'text-gray-500 border-transparent'}`}
          >
            Two-factor auth
          </button>
          <button
            onClick={() => setTab('sessions')}
            className={`px-4 py-2 text-xs font-medium border-b-2 ${tab === 'sessions' ? 'text-blue-400 border-blue-400' : 'text-gray-500 border-transparent'}`}
          >
            Active sessions
          </button>
        </div>

        <div className="flex-1 overflow-auto p-5">
          {tab === '2fa' ? <TwoFactorPanel onChanged={refresh} /> : <SessionsPanel />}
        </div>
      </div>
    </div>
  );
}

function TwoFactorPanel({ onChanged }: { onChanged: () => Promise<void> }) {
  const { user } = useAuth();
  const [phase, setPhase] = useState<'idle' | 'setup' | 'verify' | 'done'>(user?.totp_enabled ? 'done' : 'idle');
  const [secret, setSecret] = useState('');
  const [otpAuth, setOtpAuth] = useState('');
  const [code, setCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showDisable, setShowDisable] = useState(false);
  const [disablePassword, setDisablePassword] = useState('');
  const [disableCode, setDisableCode] = useState('');
  const [showRegenerate, setShowRegenerate] = useState(false);
  const [regeneratePassword, setRegeneratePassword] = useState('');

  useEffect(() => {
    setPhase(user?.totp_enabled ? 'done' : 'idle');
  }, [user?.totp_enabled]);

  const startSetup = async () => {
    setError(null);
    setLoading(true);
    try {
      const data = await authJson<{ secret: string; otpauth_url: string }>('/api/auth/2fa/setup', { method: 'POST' });
      setSecret(data.secret);
      setOtpAuth(data.otpauth_url);
      setPhase('verify');
    } catch (err) {
      setError(err instanceof Error ? err.message : '2FA setup failed');
    } finally { setLoading(false); }
  };

  const verifySetup = async () => {
    setError(null);
    setLoading(true);
    try {
      const data = await authJson<{ recovery_codes: string[] }>('/api/auth/2fa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      setRecoveryCodes(data.recovery_codes);
      await onChanged();
      setPhase('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
    } finally { setLoading(false); }
  };

  const disable = async () => {
    setError(null);
    setLoading(true);
    try {
      await authJson('/api/auth/2fa/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: disablePassword, code: disableCode }),
      });
      setShowDisable(false);
      setDisablePassword('');
      setDisableCode('');
      setRecoveryCodes(null);
      await onChanged();
      setPhase('idle');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not disable 2FA');
    } finally { setLoading(false); }
  };

  const regenerate = async () => {
    setError(null);
    setLoading(true);
    try {
      const data = await authJson<{ recovery_codes: string[] }>('/api/auth/2fa/recovery-codes/regenerate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: regeneratePassword }),
      });
      setRecoveryCodes(data.recovery_codes);
      setShowRegenerate(false);
      setRegeneratePassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not regenerate codes');
    } finally { setLoading(false); }
  };

  if (phase === 'done') {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-300 text-sm">
          <ShieldCheck size={16} /> Two-factor authentication is enabled
        </div>
        {recoveryCodes && (
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <div className="flex items-center gap-2 text-amber-300 text-xs font-semibold mb-2">
              <AlertTriangle size={14} /> Save these recovery codes now
            </div>
            <p className="text-[11px] text-amber-300/70 mb-2">
              Each code works once. They are your only way back in if you lose your authenticator app.
            </p>
            <div className="grid grid-cols-2 gap-1 font-mono text-xs text-amber-200">
              {recoveryCodes.map(c => <div key={c} className="px-2 py-1 bg-gray-950 rounded">{c}</div>)}
            </div>
            <button
              onClick={() => navigator.clipboard.writeText(recoveryCodes.join('\n'))}
              className="mt-2 text-[10px] text-amber-400 hover:text-amber-300"
            >Copy all</button>
          </div>
        )}
        <div className="flex gap-2">
          <button
            onClick={() => { setShowRegenerate(true); setShowDisable(false); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-gray-800 hover:bg-gray-700 text-xs"
          >
            <RefreshCw size={12} /> Regenerate recovery codes
          </button>
          <button
            onClick={() => { setShowDisable(true); setShowRegenerate(false); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-red-500/15 hover:bg-red-500/30 text-red-300 text-xs"
          >
            Disable 2FA
          </button>
        </div>
        {showDisable && (
          <div className="p-3 rounded-lg bg-gray-800/50 border border-gray-700 space-y-2">
            <p className="text-xs text-gray-400">Confirm with your password and a current TOTP code:</p>
            <input type="password" value={disablePassword} onChange={e => setDisablePassword(e.target.value)} placeholder="Password" className="w-full px-2 py-1.5 bg-gray-950 border border-gray-800 rounded text-xs" />
            <input type="text" inputMode="numeric" maxLength={6} value={disableCode} onChange={e => setDisableCode(e.target.value.replace(/\D/g, ''))} placeholder="6-digit code" className="w-full px-2 py-1.5 bg-gray-950 border border-gray-800 rounded text-xs font-mono" />
            <div className="flex gap-2">
              <button onClick={disable} disabled={loading} className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-xs">{loading ? '…' : 'Disable'}</button>
              <button onClick={() => setShowDisable(false)} className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs">Cancel</button>
            </div>
          </div>
        )}
        {showRegenerate && (
          <div className="p-3 rounded-lg bg-gray-800/50 border border-gray-700 space-y-2">
            <p className="text-xs text-gray-400">Confirm with your password to invalidate old codes:</p>
            <input type="password" value={regeneratePassword} onChange={e => setRegeneratePassword(e.target.value)} placeholder="Password" className="w-full px-2 py-1.5 bg-gray-950 border border-gray-800 rounded text-xs" />
            <div className="flex gap-2">
              <button onClick={regenerate} disabled={loading} className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs">{loading ? '…' : 'Regenerate'}</button>
              <button onClick={() => setShowRegenerate(false)} className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs">Cancel</button>
            </div>
          </div>
        )}
        {error && <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded p-2">{error}</div>}
      </div>
    );
  }

  if (phase === 'verify') {
    return (
      <div className="space-y-4">
        <p className="text-xs text-gray-400">
          Add this account to your authenticator (1Password, Google Authenticator, Authy, etc.) by scanning the QR code or entering the secret manually, then enter a 6-digit code to confirm.
        </p>
        <div className="flex gap-4 items-start">
          <div className="bg-white p-3 rounded">
            {/* Render QR via Google Chart API replacement: data URL fallback to text */}
            <QrCodeImage text={otpAuth} />
          </div>
          <div className="space-y-2 flex-1">
            <div>
              <p className="text-[10px] text-gray-500 uppercase">Secret (manual entry)</p>
              <p className="font-mono text-xs break-all bg-gray-950 border border-gray-800 rounded p-2">{secret}</p>
              <button onClick={() => navigator.clipboard.writeText(secret)} className="text-[10px] text-blue-400 mt-1 hover:text-blue-300">Copy</button>
            </div>
            <div>
              <p className="text-[10px] text-gray-500 uppercase mb-1">Enter the 6-digit code</p>
              <input
                type="text" inputMode="numeric" maxLength={6} value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                className="w-full px-3 py-2 bg-gray-950 border border-gray-800 rounded text-lg font-mono tracking-widest text-center"
                placeholder="123456"
              />
            </div>
            <div className="flex gap-2">
              <button onClick={verifySetup} disabled={loading || code.length !== 6} className="flex-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded text-xs font-semibold">
                {loading ? 'Verifying…' : 'Verify & enable'}
              </button>
              <button onClick={() => setPhase('idle')} className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-xs">Cancel</button>
            </div>
          </div>
        </div>
        {error && <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded p-2">{error}</div>}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-800/50 border border-gray-700">
        <Shield size={18} className="text-gray-500 mt-0.5" />
        <div className="flex-1">
          <h3 className="text-sm font-semibold">Two-factor authentication</h3>
          <p className="text-xs text-gray-400 mt-1">
            Add a second step at sign-in using a TOTP authenticator app. We'll also issue 10 recovery codes you can use if you lose your device.
          </p>
        </div>
      </div>
      <button onClick={startSetup} disabled={loading} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded text-xs font-semibold flex items-center gap-2">
        <KeyRound size={12} /> {loading ? 'Setting up…' : 'Set up two-factor authentication'}
      </button>
      {error && <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded p-2">{error}</div>}
    </div>
  );
}

function QrCodeImage({ text }: { text: string }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(text, { errorCorrectionLevel: 'M', margin: 1, scale: 5 })
      .then(url => { if (!cancelled) setDataUrl(url); })
      .catch(e => { if (!cancelled) setErr(e instanceof Error ? e.message : 'QR generation failed'); });
    return () => { cancelled = true; };
  }, [text]);
  if (err) return <div className="w-40 h-40 flex items-center justify-center text-[10px] text-red-500">{err}</div>;
  if (!dataUrl) return <div className="w-40 h-40 flex items-center justify-center text-[10px] text-gray-500">Generating…</div>;
  return <img src={dataUrl} alt="2FA QR code" className="w-40 h-40" />;
}

function SessionsPanel() {
  const { logout } = useAuth();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await authJson<{ sessions: SessionRow[] }>('/api/auth/sessions');
      setSessions(data.sessions);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sessions');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const revoke = async (id: string, isCurrent: boolean) => {
    try {
      await authJson(`/api/auth/sessions/${id}`, { method: 'DELETE' });
      if (isCurrent) {
        await logout();
        return;
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke');
    }
  };

  const revokeAll = async () => {
    try {
      await authJson('/api/auth/sessions/revoke-all', { method: 'POST' });
      await logout();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke all');
    }
  };

  const isActive = (s: SessionRow) =>
    !s.revoked_at && new Date(s.expires_at).getTime() > Date.now();

  if (loading) return <div className="text-xs text-gray-500">Loading sessions…</div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-400">All devices currently signed in to this account.</p>
        <button onClick={revokeAll} className="flex items-center gap-1 px-3 py-1.5 rounded bg-red-500/15 hover:bg-red-500/30 text-red-300 text-xs">
          <LogOut size={12} /> Sign out everywhere
        </button>
      </div>
      {error && <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded p-2">{error}</div>}
      <ul className="space-y-2">
        {sessions.map(s => (
          <li key={s.id} className="flex items-center gap-3 p-3 rounded-lg bg-gray-800/40 border border-gray-700">
            <Monitor size={18} className="text-gray-500" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-gray-200 truncate">{s.user_agent || 'Unknown device'}</span>
                {s.is_current && (
                  <span className="px-1.5 py-0.5 text-[9px] rounded bg-green-500/20 text-green-300">Current</span>
                )}
                {!isActive(s) && (
                  <span className="px-1.5 py-0.5 text-[9px] rounded bg-gray-700 text-gray-400">Revoked</span>
                )}
                {s.reuse_detected && (
                  <span className="px-1.5 py-0.5 text-[9px] rounded bg-red-500/20 text-red-300" title="A reused refresh token was detected. The session was force-revoked.">Reuse detected</span>
                )}
              </div>
              <div className="text-[10px] text-gray-500 mt-1">
                IP {s.ip || '—'} · created {new Date(s.created_at).toLocaleString()}
              </div>
            </div>
            {isActive(s) && (
              <button onClick={() => revoke(s.id, s.is_current)} className="p-1.5 rounded hover:bg-red-500/20 text-gray-400 hover:text-red-300" title="Revoke this session">
                <X size={14} />
              </button>
            )}
            {!isActive(s) && <Check size={14} className="text-gray-700" />}
          </li>
        ))}
        {sessions.length === 0 && (
          <li className="text-xs text-gray-500">No sessions found.</li>
        )}
      </ul>
    </div>
  );
}
