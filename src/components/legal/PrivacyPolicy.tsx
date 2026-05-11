// TODO: Search USPTO TESS for "FetchLab" trademark before commercial launch

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <header className="border-b border-gray-800 bg-gray-900/50">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <a href="/" className="text-lg font-bold hover:text-blue-400">🧪 FetchLab</a>
          <nav className="flex items-center gap-4 text-sm text-gray-400">
            <a href="/" className="hover:text-gray-100">Home</a>
            <a href="/terms" className="hover:text-gray-100">Terms</a>
          </nav>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10">
        <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-sm text-gray-500 mb-8">Effective Date: May 1, 2025</p>

        <section className="space-y-6 text-sm leading-relaxed text-gray-300">
          <p>
            FetchLab ("we", "us", "our") provides an API development and testing platform. This Privacy Policy
            explains what information we collect, how we use it, and what rights you have over your data. By
            using FetchLab you agree to the practices described below.
          </p>

          <div>
            <h2 className="text-xl font-semibold text-gray-100 mb-2">1. Information We Collect</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>Account information.</strong> When you register, we collect your name, email address,
                and a securely hashed password (bcrypt). We never store passwords in plain text.
              </li>
              <li>
                <strong>API request history.</strong> Requests, collections, environments, and responses you
                create are stored locally in your browser (localStorage) and/or in your FetchLab database
                instance. Sensitive request fields (tokens, secrets, credentials) are encrypted at rest using
                AES-256-GCM.
              </li>
              <li>
                <strong>Credentials and API keys.</strong> Any credentials you store in FetchLab — including
                your own LLM provider keys, OAuth tokens, and basic-auth secrets — are encrypted with
                AES-256-GCM before being persisted.
              </li>
              <li>
                <strong>Operational logs.</strong> Server-side audit logs record authentication events, admin
                actions, and key-management operations. These logs do not contain request bodies or secrets.
              </li>
            </ul>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-gray-100 mb-2">2. Bring Your Own Key (BYOK)</h2>
            <p>
              FetchLab's AI-assisted features support BYOK: you may supply your own API key for an LLM provider
              such as Anthropic. When BYOK is enabled, your prompts and any associated request data are sent
              directly to <em>your</em> chosen provider under <em>your</em> contractual terms with that
              provider. FetchLab does not proxy, log, or retain that content. The provider's privacy policy
              governs that traffic, not ours.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-gray-100 mb-2">3. How We Use Your Information</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>To provide, maintain, and improve the FetchLab service.</li>
              <li>To authenticate you and secure your account.</li>
              <li>To respond to support requests and communicate service-related notices.</li>
              <li>To detect and prevent abuse, fraud, and security incidents.</li>
            </ul>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-gray-100 mb-2">4. What We Do Not Do</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>We do <strong>not</strong> sell your personal information to anyone.</li>
              <li>We do <strong>not</strong> share your data with third-party advertisers or data brokers.</li>
              <li>
                We do <strong>not</strong> read, inspect, or train models on the content of your API requests,
                responses, or credentials.
              </li>
            </ul>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-gray-100 mb-2">5. Cookies and Local Storage</h2>
            <p>
              We use a single <code className="px-1 py-0.5 bg-gray-900 rounded text-xs">httpOnly</code> session
              cookie to hold a signed JWT used for authentication. This cookie is essential for the service to
              function. We also use your browser's <code className="px-1 py-0.5 bg-gray-900 rounded text-xs">localStorage</code>
              to persist application state (open tabs, pane sizes, draft requests). No third-party tracking or
              advertising cookies are set by FetchLab.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-gray-100 mb-2">6. Data Retention and Deletion</h2>
            <p>
              We retain account and request data for as long as your account is active. You may delete your
              account at any time from your account settings; doing so removes your account record, encrypted
              credentials, and request history from our active systems. Audit logs may be retained for a
              limited period as required for security and legal compliance.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-gray-100 mb-2">7. Your Rights (GDPR / UK GDPR)</h2>
            <p>If you are located in the EEA, UK, or a jurisdiction with similar laws, you have the right to:</p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li><strong>Access</strong> the personal data we hold about you.</li>
              <li><strong>Rectify</strong> inaccurate or incomplete personal data.</li>
              <li><strong>Erase</strong> your personal data ("right to be forgotten").</li>
              <li><strong>Portability</strong> — receive your data in a machine-readable format.</li>
              <li><strong>Object to or restrict</strong> processing of your personal data.</li>
              <li><strong>Withdraw consent</strong> at any time where processing is based on consent.</li>
            </ul>
            <p className="mt-2">
              To exercise any of these rights, contact us at the email below. We will respond within 30 days.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-gray-100 mb-2">8. Security</h2>
            <p>
              We protect data in transit with TLS and at rest with AES-256-GCM for sensitive fields. Passwords
              are hashed with bcrypt. Despite our efforts, no system is perfectly secure; we encourage you to
              use strong, unique passwords and enable any available SSO options for your account.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-gray-100 mb-2">9. Children's Privacy</h2>
            <p>FetchLab is not directed to children under 13, and we do not knowingly collect data from them.</p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-gray-100 mb-2">10. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. Material changes will be communicated via
              the service or by email; the "Effective Date" above will be updated accordingly.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-gray-100 mb-2">11. Contact</h2>
            <p>
              Questions, requests, or complaints about this policy can be sent to{' '}
              <a href="mailto:vkavali10@gmail.com" className="text-blue-400 hover:underline">
                vkavali10@gmail.com
              </a>.
            </p>
          </div>
        </section>

        <footer className="mt-12 pt-6 border-t border-gray-800 text-xs text-gray-500 flex items-center justify-between">
          <span>© 2025 FetchLab</span>
          <div className="flex items-center gap-4">
            <a href="/privacy" className="hover:text-gray-300">Privacy Policy</a>
            <a href="/terms" className="hover:text-gray-300">Terms of Service</a>
          </div>
        </footer>
      </main>
    </div>
  );
}
