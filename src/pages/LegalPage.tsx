import { useEffect } from 'react';

const BG = '#0a0a0a';
const EMERALD = '#10b981';

function useUnlockScroll() {
  useEffect(() => {
    const prevBodyOverflow = document.body.style.overflow;
    const prevBodyHeight = document.body.style.height;
    const root = document.getElementById('root');
    const prevRootHeight = root?.style.height ?? '';
    const prevRootOverflow = root?.style.overflow ?? '';
    document.body.style.overflow = 'auto';
    document.body.style.height = 'auto';
    if (root) {
      root.style.height = 'auto';
      root.style.overflow = 'visible';
    }
    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.body.style.height = prevBodyHeight;
      if (root) {
        root.style.height = prevRootHeight;
        root.style.overflow = prevRootOverflow;
      }
    };
  }, []);
}

export default function LegalPage({ kind }: { kind: 'privacy' | 'terms' }) {
  useUnlockScroll();
  const isPrivacy = kind === 'privacy';
  return (
    <div className="min-h-screen w-full text-gray-100 font-sans" style={{ background: BG }}>
      <header className="border-b border-[#1f1f23]">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2 text-white font-semibold tracking-tight">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" stroke={EMERALD} strokeWidth="1.8" strokeLinejoin="round" />
            </svg>
            <span>FetchLab</span>
          </a>
          <a href="/app" className="text-sm text-gray-400 hover:text-gray-200">Sign in</a>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-semibold text-white tracking-tight mb-6">
          {isPrivacy ? 'Privacy Policy' : 'Terms of Service'}
        </h1>
        <p className="text-sm text-gray-500 mb-8">Last updated: May 12, 2026</p>
        <div className="space-y-6 text-sm text-gray-300 leading-relaxed">
          {isPrivacy ? (
            <>
              <p>
                FetchLab is designed around a single principle: your API
                credentials, requests, and responses stay under your control.
              </p>
              <p>
                <strong className="text-white">Data we store.</strong> Account
                metadata (email, hashed password), workspace settings, and
                request history you explicitly save. All sensitive material is
                encrypted with AES-256-GCM.
              </p>
              <p>
                <strong className="text-white">LLM usage.</strong> When you use
                AI features, prompts are sent to the LLM provider you configure
                (Anthropic, AWS Bedrock, Google Vertex, OpenAI, or a local
                model). With BYOK, the request flows from your browser to your
                provider — FetchLab does not retain prompt content.
              </p>
              <p>
                <strong className="text-white">Zero retention.</strong> Team and
                Enterprise plans can opt into a zero-retention mode where no
                request payloads are persisted on our servers.
              </p>
              <p className="text-gray-500">
                Questions? Email <a className="text-emerald-400 hover:text-emerald-300" href="mailto:hello@fetchlab.dev">hello@fetchlab.dev</a>.
              </p>
            </>
          ) : (
            <>
              <p>
                By using FetchLab you agree to these terms. They cover acceptable
                use, billing, and the limits of our liability.
              </p>
              <p>
                <strong className="text-white">Acceptable use.</strong> Do not
                use FetchLab to attack systems you do not own or have permission
                to test, to bypass security controls, or to violate applicable
                law.
              </p>
              <p>
                <strong className="text-white">Billing.</strong> Paid plans are
                billed monthly or annually. You can cancel anytime; access
                continues through the end of the paid period.
              </p>
              <p>
                <strong className="text-white">Availability.</strong> We strive
                for high availability but FetchLab is provided "as is" without
                warranty. Our liability is limited to fees paid in the prior
                twelve months.
              </p>
              <p className="text-gray-500">
                Questions? Email <a className="text-emerald-400 hover:text-emerald-300" href="mailto:hello@fetchlab.dev">hello@fetchlab.dev</a>.
              </p>
            </>
          )}
        </div>
        <div className="mt-12 pt-6 border-t border-[#1f1f23]">
          <a href="/" className="text-sm text-gray-400 hover:text-gray-200">← Back to home</a>
        </div>
      </main>
    </div>
  );
}
