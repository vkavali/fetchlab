import type { ReactNode } from 'react';
import { FetchLabLogo } from '../FetchLabLogo';

interface LegalLayoutProps {
  title: string;
  effective: string;
  children: ReactNode;
}

export default function LegalLayout({ title, effective, children }: LegalLayoutProps) {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#e5e5e5] font-sans">
      <header className="border-b border-[#262626]">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2 text-sm text-[#e5e5e5] hover:text-white" aria-label="FetchLab home">
            <FetchLabLogo markSize={20} wordmarkSize={11.5} />
          </a>
          <nav className="flex items-center gap-5 text-xs text-[#737373]">
            <a href="/privacy" className="hover:text-[#e5e5e5]">Privacy</a>
            <a href="/terms" className="hover:text-[#e5e5e5]">Terms</a>
            <a href="/" className="hover:text-[#e5e5e5]">Back to app</a>
          </nav>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-semibold text-white mb-2">{title}</h1>
        <p className="text-xs text-[#737373] mb-10">Effective: {effective}</p>
        <div className="legal-prose space-y-6 text-[13px] leading-relaxed text-[#d4d4d4]">
          {children}
        </div>

        <footer className="mt-16 pt-6 border-t border-[#262626] text-xs text-[#737373] flex flex-wrap items-center justify-between gap-3">
          <span>© {new Date().getFullYear()} FetchLab. All rights reserved.</span>
          <a href="mailto:vkavali10@gmail.com" className="hover:text-[#e5e5e5]">vkavali10@gmail.com</a>
        </footer>
      </main>
    </div>
  );
}
