import { useState } from 'react';
import { X } from 'lucide-react';

const DISMISS_KEY = 'fetchlab_trial_banner_dismissed';

interface TrialBannerProps {
  daysRemaining: number;
  onSignUp: () => void;
}

export default function TrialBanner({ daysRemaining, onSignUp }: TrialBannerProps) {
  const [dismissed, setDismissed] = useState(() => {
    try { return sessionStorage.getItem(DISMISS_KEY) === '1'; }
    catch { return false; }
  });

  if (dismissed) return null;

  const dismiss = () => {
    try { sessionStorage.setItem(DISMISS_KEY, '1'); } catch { /* ignore */ }
    setDismissed(true);
  };

  const dayLabel = daysRemaining === 1 ? 'day' : 'days';
  const trialEnded = daysRemaining <= 0;

  return (
    <div
      className="flex items-center justify-between px-4 py-1.5 border-b text-xs"
      style={{
        background: 'var(--color-warning-soft)',
        borderColor: 'var(--color-warning)',
        color: 'var(--color-warning)',
      }}
    >
      <div className="flex items-center gap-2">
        <span>
          You're using FetchLab free.{' '}
          {!trialEnded && (
            <>
              <strong>{daysRemaining} {dayLabel} left in your trial.</strong>{' '}
            </>
          )}
          <button
            onClick={onSignUp}
            className="underline font-medium"
            style={{ color: 'var(--color-accent)' }}
          >
            Sign up
          </button>{' '}
          to save your work across devices.
        </span>
      </div>
      <button
        onClick={dismiss}
        className="ml-2 opacity-70 hover:opacity-100"
        style={{ color: 'var(--color-warning)' }}
        title="Dismiss"
        aria-label="Dismiss trial banner"
      >
        <X size={14} />
      </button>
    </div>
  );
}
