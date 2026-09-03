import { FetchLabLogo } from '../components/FetchLabLogo';
import { usePublicLightTheme } from '../utils/usePublicLightTheme';

const VERSION = '1.2.0';
const EXE_HREF = '/downloads/FetchLab_1.2.0_x64-setup.exe';
const MSI_HREF = '/downloads/FetchLab_1.2.0_x64_en-US.msi';

function Nav() {
  return (
    <nav
      className="sticky top-0 z-50"
      style={{
        background: 'color-mix(in oklch, var(--color-bg) 90%, transparent)',
        backdropFilter: 'saturate(140%) blur(6px)',
        WebkitBackdropFilter: 'saturate(140%) blur(6px)',
        borderBottom: '1px solid var(--color-border)',
      }}
    >
      <div className="max-w-[1180px] mx-auto px-6 lg:px-8 h-14 flex items-center justify-between">
        <a href="/" aria-label="FetchLab home">
          <FetchLabLogo markSize={28} wordmarkSize={13.5} />
        </a>
        <div className="hidden md:flex items-center gap-9" style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
          <a href="/#how" className="hover:opacity-100 transition-opacity" style={{ opacity: 0.85 }}>The loop</a>
          <a href="/how-to" className="hover:opacity-100 transition-opacity" style={{ opacity: 0.85 }}>How-to</a>
          <a href="/ai-how-to" className="hover:opacity-100 transition-opacity" style={{ opacity: 0.85 }}>AI guide</a>
          <a href="/download" style={{ opacity: 1, color: 'var(--color-text)' }}>Download</a>
          <a href="/enterprise" className="hover:opacity-100 transition-opacity" style={{ opacity: 0.85 }}>Enterprise</a>
          <a href="/pricing" className="hover:opacity-100 transition-opacity" style={{ opacity: 0.85 }}>Pricing</a>
        </div>
        <a
          href="/app"
          className="inline-flex items-center"
          style={{
            fontSize: 12.5,
            fontWeight: 600,
            color: 'var(--color-accent-ink)',
            background: 'var(--color-accent)',
            padding: '6px 12px',
            borderRadius: 5,
          }}
        >
          Open app
        </a>
      </div>
    </nav>
  );
}

function DownloadCard({
  title,
  subtitle,
  href,
  filename,
  primary = false,
}: {
  title: string;
  subtitle: string;
  href: string;
  filename: string;
  primary?: boolean;
}) {
  return (
    <div
      className="flex flex-col"
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 8,
        padding: 24,
      }}
    >
      <div className="font-mono uppercase" style={{ color: 'var(--color-text-subtle)', fontSize: 10.5, letterSpacing: '0.14em', marginBottom: 10 }}>
        Windows - {VERSION}
      </div>
      <h3 className="text-xl" style={{ color: 'var(--color-text)', fontWeight: 650, margin: '0 0 6px' }}>
        {title}
      </h3>
      <p style={{ color: 'var(--color-text-muted)', fontSize: 14, lineHeight: 1.6, margin: '0 0 22px' }}>
        {subtitle}
      </p>
      <a
        href={href}
        download={filename}
        className="inline-flex items-center justify-center transition-colors"
        style={{
          background: primary ? 'var(--color-accent)' : 'var(--color-surface-2)',
          color: primary ? 'var(--color-accent-ink)' : 'var(--color-text)',
          border: primary ? '1px solid var(--color-accent)' : '1px solid var(--color-border-strong)',
          borderRadius: 5,
          fontSize: 13.5,
          fontWeight: 650,
          padding: '10px 14px',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = primary ? 'var(--color-accent-hover)' : 'var(--color-surface-3)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = primary ? 'var(--color-accent)' : 'var(--color-surface-2)';
        }}
      >
        Download {filename.endsWith('.msi') ? 'MSI' : 'Installer'}
      </a>
      <div className="font-mono" style={{ color: 'var(--color-text-subtle)', fontSize: 11, marginTop: 12 }}>
        {filename}
      </div>
    </div>
  );
}

export default function Download() {
  usePublicLightTheme();

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-bg)', color: 'var(--color-text)' }}>
      <Nav />
      <main className="max-w-[1180px] mx-auto px-6 lg:px-8 py-14 md:py-20">
        <section className="grid lg:grid-cols-[0.95fr_1.05fr] gap-10 lg:gap-16 items-end" style={{ marginBottom: 42 }}>
          <div>
            <div className="font-mono uppercase" style={{ color: 'var(--color-accent)', fontSize: 11, letterSpacing: '0.16em', marginBottom: 18 }}>
              Web app + desktop installer
            </div>
            <h1
              className="text-4xl md:text-6xl"
              style={{
                fontFamily: 'var(--font-display)',
                letterSpacing: 0,
                lineHeight: 0.92,
                margin: 0,
                maxWidth: '10ch',
              }}
            >
              Download FetchLab
            </h1>
          </div>
          <p className="text-base md:text-lg" style={{ color: 'var(--color-text-muted)', lineHeight: 1.75, maxWidth: 620, margin: 0 }}>
            Use FetchLab immediately in the browser, or install the Windows desktop build for local workflows and managed team rollouts.
            Version {VERSION}. macOS and Linux installers are planned next.
          </p>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-px" style={{ background: 'var(--color-border)', border: '1px solid var(--color-border)', marginBottom: 34 }}>
          <DownloadCard
            title="Windows Installer"
            subtitle="Recommended for most users. Standard setup wizard."
            href={EXE_HREF}
            filename="FetchLab_1.2.0_x64-setup.exe"
            primary
          />
          <DownloadCard
            title="MSI Package"
            subtitle="For managed deployments and group policy installs."
            href={MSI_HREF}
            filename="FetchLab_1.2.0_x64_en-US.msi"
          />
        </section>

        <div style={{ color: 'var(--color-text-muted)', fontSize: 13.5 }}>
          The browser app is available now, and the Windows installer files are included on this page.{' '}
          <a href="/app" style={{ color: 'var(--color-accent)', textDecoration: 'underline', textUnderlineOffset: 4 }}>
            Open FetchLab in the browser
          </a>
          {' '}or use the MSI for managed enterprise deployment.
        </div>
      </main>
    </div>
  );
}
