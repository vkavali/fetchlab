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

  return (
    <div className="flex items-center justify-between px-4 py-1.5 bg-blue-500/10 border-b border-blue-500/20 text-blue-300 text-xs">
      <div className="flex items-center gap-2">
        <span>
          You're using FetchLab as a guest. <strong>{daysRemaining} {dayLabel} remaining.</strong>{' '}
          <button
            onClick={onSignUp}
            className="underline hover:text-blue-200 font-semibold"
          >
            Sign up
          </button>{' '}
          to save your work.
        </span>
      </div>
      <button
        onClick={dismiss}
        className="text-blue-400/70 hover:text-blue-200 ml-2"
        title="Dismiss"
        aria-label="Dismiss trial banner"
      >
        <X size={14} />
      </button>
    </div>
  );
}
