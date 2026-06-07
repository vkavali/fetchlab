import type { ReactNode } from 'react';
import { FetchLabLogo } from '../FetchLabLogo';
import { usePublicLightTheme } from '../../utils/usePublicLightTheme';

interface LegalLayoutProps {
  title: string;
  effective: string;
  children: ReactNode;
}

export default function LegalLayout({ title, effective, children }: LegalLayoutProps) {
  usePublicLightTheme();

  return (
    <div className="min-h-screen font-sans" style={{ background: 'var(--color-bg)', color: 'var(--color-text)' }}>
      <header style={{ borderBottom: '1px solid var(--color-border)' }}>
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-text)' }} aria-label="FetchLab home">
            <FetchLabLogo markSize={24} wordmarkSize={12} />
          </a>
          <nav className="flex items-center gap-5 text-xs" style={{ color: 'var(--color-text-muted)' }}>
            <a href="/privacy">Privacy</a>
            <a href="/terms">Terms</a>
            <a href="/">Back to app</a>
          </nav>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-semibold mb-2" style={{ color: 'var(--color-text)' }}>{title}</h1>
        <p className="text-xs mb-10" style={{ color: 'var(--color-text-muted)' }}>Effective: {effective}</p>
        <div className="legal-prose space-y-6 text-[13px] leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
          {children}
        </div>

        <footer className="mt-16 pt-6 text-xs flex flex-wrap items-center justify-between gap-3" style={{ borderTop: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}>
          <span>(c) {new Date().getFullYear()} FetchLab. All rights reserved.</span>
          <a href="mailto:vkavali10@gmail.com">vkavali10@gmail.com</a>
        </footer>
      </main>
    </div>
  );
}
