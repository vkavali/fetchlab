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
        x="4"
        y="4"
        width="40"
        height="40"
        rx="10"
        fill="var(--color-surface)"
        stroke="var(--color-border-strong)"
        strokeWidth="1.5"
      />
      <path
        d="M18 11H30M21 11V18L14 31C13.05 32.76 14.32 35 16.32 35H31.68C33.68 35 34.95 32.76 34 31L27 18V11"
        stroke="var(--color-text)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M18 28H30"
        stroke="var(--color-border-strong)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M16 32L23 25H29"
        stroke="var(--color-accent)"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="16" cy="32" r="2.5" fill="var(--color-accent)" />
      <circle cx="29" cy="25" r="2.5" fill="var(--color-accent)" />
      <path
        d="M23 18H27"
        stroke="var(--color-accent)"
        strokeWidth="2"
        strokeLinecap="round"
      />
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
