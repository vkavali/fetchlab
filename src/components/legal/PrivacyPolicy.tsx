import LegalLayout from './LegalLayout';

export default function PrivacyPolicy() {
  return (
    <LegalLayout title="Privacy Policy" effective="May 2025">
      <p>
        FetchLab (&ldquo;FetchLab,&rdquo; &ldquo;we,&rdquo; &ldquo;our&rdquo;) provides an API testing
        workspace. This policy explains what data we collect, how we use it, and the rights you have
        over it. We aim to collect as little as possible.
      </p>

      <section>
        <h2 className="text-base font-semibold text-white mb-2">1. Information we collect</h2>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>
            <strong className="text-white font-medium">Account data:</strong> email address and
            display name when you create an account or sign in via SSO.
          </li>
          <li>
            <strong className="text-white font-medium">API request history:</strong> requests you
            make through FetchLab are stored locally in your browser or, for team workspaces, in our
            encrypted database. You can clear this history at any time.
          </li>
          <li>
            <strong className="text-white font-medium">Credentials and secrets:</strong> any API
            keys, tokens, or passwords you save are encrypted at rest using AES-256-GCM before being
            written to disk. The encryption key never leaves the server.
          </li>
          <li>
            <strong className="text-white font-medium">Operational logs:</strong> minimal server
            logs (timestamps, request paths, status codes) used to keep the service running and to
            detect abuse. No request bodies or response bodies are logged.
          </li>
        </ul>
      </section>

      <section>
        <h2 className="text-base font-semibold text-white mb-2">2. Bring-your-own-key (BYOK)</h2>
        <p>
          FetchLab&rsquo;s AI features run on a large language model provider that you authenticate
          with your own API key. When you use these features, your prompts and responses go directly
          to your chosen provider under their privacy terms. FetchLab does not receive, store, or
          retain a copy of those prompts or responses.
        </p>
      </section>

      <section>
        <h2 className="text-base font-semibold text-white mb-2">3. How we use your data</h2>
        <p>We use the information above to:</p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>operate, maintain, and improve the service;</li>
          <li>authenticate you and protect your account;</li>
          <li>provide support when you ask for it;</li>
          <li>comply with legal obligations.</li>
        </ul>
        <p className="mt-3">
          We <strong className="text-white font-medium">do not sell</strong> personal data. We
          <strong className="text-white font-medium"> do not share</strong> personal data with third
          parties for their own marketing purposes. We do not use your request bodies or response
          bodies to train any model.
        </p>
      </section>

      <section>
        <h2 className="text-base font-semibold text-white mb-2">4. Cookies and local storage</h2>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>
            <strong className="text-white font-medium">Authentication:</strong> a JWT is stored in
            an <code className="font-mono text-[12px] text-[#10b981]">httpOnly</code> cookie so that
            JavaScript on the page cannot read it.
          </li>
          <li>
            <strong className="text-white font-medium">App state:</strong> your local preferences
            (sidebar width, theme, open tabs) are stored in browser{' '}
            <code className="font-mono text-[12px] text-[#10b981]">localStorage</code>. This data
            never leaves your device.
          </li>
        </ul>
      </section>

      <section>
        <h2 className="text-base font-semibold text-white mb-2">5. Your rights (GDPR / CCPA)</h2>
        <p>If you are in the EU, UK, or California, you have the right to:</p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li><strong className="text-white font-medium">Access</strong> the personal data we hold about you;</li>
          <li><strong className="text-white font-medium">Rectify</strong> inaccurate data;</li>
          <li><strong className="text-white font-medium">Erase</strong> your account and associated data;</li>
          <li><strong className="text-white font-medium">Port</strong> your data in a machine-readable format;</li>
          <li><strong className="text-white font-medium">Object</strong> to or restrict certain processing.</li>
        </ul>
        <p className="mt-3">
          To exercise any of these rights, email{' '}
          <a href="mailto:vkavali10@gmail.com" className="text-[#10b981] hover:underline">
            vkavali10@gmail.com
          </a>
          . We respond within 30 days.
        </p>
      </section>

      <section>
        <h2 className="text-base font-semibold text-white mb-2">6. Security</h2>
        <p>
          Credentials are encrypted with AES-256-GCM at rest. Passwords are hashed with bcrypt. All
          traffic is served over HTTPS. Access to production systems is restricted and logged. No
          system is perfectly secure, and we will notify affected users without undue delay if we
          ever learn of a breach involving their data.
        </p>
      </section>

      <section>
        <h2 className="text-base font-semibold text-white mb-2">7. Retention</h2>
        <p>
          We retain account and workspace data for as long as your account is active. When you
          delete your account, we remove your data within 30 days, except where a longer period is
          required by law.
        </p>
      </section>

      <section>
        <h2 className="text-base font-semibold text-white mb-2">8. Children</h2>
        <p>FetchLab is not directed to children under 16, and we do not knowingly collect data from them.</p>
      </section>

      <section>
        <h2 className="text-base font-semibold text-white mb-2">9. Changes to this policy</h2>
        <p>
          If we make material changes, we will update the effective date above and notify active
          account holders by email at least 14 days before the change takes effect.
        </p>
      </section>

      <section>
        <h2 className="text-base font-semibold text-white mb-2">10. Contact</h2>
        <p>
          Questions or requests can be sent to{' '}
          <a href="mailto:vkavali10@gmail.com" className="text-[#10b981] hover:underline">
            vkavali10@gmail.com
          </a>
          .
        </p>
      </section>
    </LegalLayout>
  );
}
