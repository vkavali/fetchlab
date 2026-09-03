import { useState } from 'react';
import { X } from 'lucide-react';

const DISMISS_KEY = 'fetchlab_trial_banner_dismissed';

interface TrialBannerProps {
  onSignUp: () => void;
}

export default function TrialBanner({ onSignUp }: TrialBannerProps) {
  const [dismissed, setDismissed] = useState(() => {
    try { return sessionStorage.getItem(DISMISS_KEY) === '1'; }
    catch { return false; }
  });

  if (dismissed) return null;

  const dismiss = () => {
    try { sessionStorage.setItem(DISMISS_KEY, '1'); } catch { /* ignore */ }
    setDismissed(true);
  };

  return (
    <div
      className="flex items-center justify-between gap-3 px-3 sm:px-4 py-2 border-b text-[13px]"
      style={{
        background: 'var(--color-accent-soft)',
        borderColor: 'var(--color-border)',
        color: 'var(--color-text-muted)',
      }}
    >
      <div className="min-w-0 leading-5">
        <span>
          Local mode keeps drafts on this device.{' '}
          <button
            onClick={onSignUp}
            className="underline font-semibold underline-offset-2"
            style={{ color: 'var(--color-accent)' }}
          >
            Sign up
          </button>{' '}
          to connect GitHub and run Product Missions with your team.
        </span>
      </div>
      <button
        onClick={dismiss}
        className="p-1 flex-none opacity-70 hover:opacity-100"
        style={{ color: 'var(--color-text-muted)' }}
        title="Dismiss"
        aria-label="Dismiss local mode banner"
      >
        <X size={14} />
      </button>
    </div>
  );
}
