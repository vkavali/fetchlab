const INDIGO = '#6366F1';
const INDIGO_HOVER = '#4F46E5';
const TEXT_DARK = '#111827';
const TEXT_BODY = '#6B7280';
const BORDER = '#E5E7EB';

const VERSION = '1.2.0';
const EXE_HREF = '/downloads/FetchLab_1.2.0_x64-setup.exe';
const MSI_HREF = '/downloads/FetchLab_1.2.0_x64_en-US.msi';

function Nav() {
  return (
    <nav
      className="sticky top-0 z-50 bg-white/85 backdrop-blur-md"
      style={{ borderBottom: `1px solid ${BORDER}` }}
    >
      <div className="max-w-6xl mx-auto px-6 lg:px-8 h-14 flex items-center justify-between">
        <a href="/" className="text-[15px] font-semibold tracking-tight" style={{ color: TEXT_DARK }}>
          FetchLab
        </a>
        <div className="hidden md:flex items-center gap-9 text-[13px]" style={{ color: TEXT_DARK }}>
          <a href="/#how" className="hover:opacity-60 transition-opacity">How it works</a>
          <a href="/how-to" className="hover:opacity-60 transition-opacity">How-to</a>
          <a href="/download" className="hover:opacity-60 transition-opacity">Download</a>
          <a href="/#pricing" className="hover:opacity-60 transition-opacity">Pricing</a>
        </div>
        <a
          href="/app"
          className="text-[13px] px-4 py-1.5 rounded-full text-white font-medium transition-colors"
          style={{ backgroundColor: INDIGO }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = INDIGO_HOVER)}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = INDIGO)}
        >
          Get Started
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
      className="rounded-2xl p-6 bg-white flex flex-col"
      style={{ border: `1px solid ${BORDER}` }}
    >
      <div className="text-[12px] uppercase tracking-wider mb-2" style={{ color: TEXT_BODY }}>
        Windows · {VERSION}
      </div>
      <h3 className="text-xl font-semibold mb-1" style={{ color: TEXT_DARK }}>
        {title}
      </h3>
      <p className="text-[14px] mb-5" style={{ color: TEXT_BODY }}>
        {subtitle}
      </p>
      <a
        href={href}
        download={filename}
        className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full text-[14px] font-semibold transition-colors"
        style={
          primary
            ? { backgroundColor: INDIGO, color: '#fff' }
            : { backgroundColor: '#fff', color: TEXT_DARK, border: `1px solid ${BORDER}` }
        }
        onMouseEnter={(e) => {
          if (primary) e.currentTarget.style.backgroundColor = INDIGO_HOVER;
          else e.currentTarget.style.backgroundColor = '#F9FAFB';
        }}
        onMouseLeave={(e) => {
          if (primary) e.currentTarget.style.backgroundColor = INDIGO;
          else e.currentTarget.style.backgroundColor = '#fff';
        }}
      >
        Download {filename.endsWith('.msi') ? 'MSI' : 'Installer'}
        <span aria-hidden>↓</span>
      </a>
      <div className="text-[11px] mt-3 font-mono" style={{ color: TEXT_BODY }}>
        {filename}
      </div>
    </div>
  );
}

export default function Download() {
  return (
    <div className="min-h-screen bg-white" style={{ color: TEXT_DARK }}>
      <Nav />
      <main className="max-w-4xl mx-auto px-6 lg:px-8 py-16 md:py-24">
        <h1 className="text-4xl md:text-5xl font-semibold tracking-tight mb-4">
          Download FetchLab
        </h1>
        <p className="text-base md:text-lg max-w-xl mb-12" style={{ color: TEXT_BODY }}>
          The FetchLab desktop app for Windows. Free during the public beta.
          Version {VERSION}.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
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
        </div>

        <div className="mt-12 text-[13px]" style={{ color: TEXT_BODY }}>
          macOS and Linux builds are coming soon.
          {' '}
          <a href="/app" className="underline" style={{ color: INDIGO }}>
            Use FetchLab in the browser
          </a>{' '}
          in the meantime.
        </div>
      </main>
    </div>
  );
}
