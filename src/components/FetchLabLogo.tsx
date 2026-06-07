interface FetchLabMarkProps {
  size?: number;
  title?: string;
}

interface FetchLabLogoProps {
  markSize?: number;
  wordmarkSize?: number;
  showWordmark?: boolean;
}

export function FetchLabMark({ size = 28, title = 'FetchLab' }: FetchLabMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      role={title ? 'img' : undefined}
      aria-label={title || undefined}
      aria-hidden={title ? undefined : true}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block', flexShrink: 0 }}
    >
      <rect
        x="3"
        y="3"
        width="42"
        height="42"
        rx="12"
        fill="var(--color-accent)"
        stroke="var(--color-text)"
        strokeOpacity="0.18"
        strokeWidth="2"
      />
      <path
        d="M14 17H31M26 12L31 17L26 22"
        stroke="var(--color-accent-ink)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M34 31H17M22 26L17 31L22 36"
        stroke="var(--color-accent-ink)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M22 24H30"
        stroke="var(--color-accent-ink)"
        strokeOpacity="0.45"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="24" cy="24" r="3.2" fill="var(--color-warning)" />
    </svg>
  );
}

export function FetchLabLogo({
  markSize = 28,
  wordmarkSize = 13,
  showWordmark = true,
}: FetchLabLogoProps) {
  return (
    <span className="inline-flex items-center gap-2.5" style={{ color: 'var(--color-text)' }}>
      <FetchLabMark size={markSize} title={showWordmark ? '' : 'FetchLab'} />
      {showWordmark && (
        <span className="fl-wordmark" style={{ fontSize: wordmarkSize, color: 'var(--color-text)' }}>
          FETCHLAB
        </span>
      )}
    </span>
  );
}
