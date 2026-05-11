export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <header className="border-b border-gray-800 bg-gray-900/50">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <a href="/" className="text-lg font-bold hover:text-blue-400">🧪 FetchLab</a>
          <nav className="flex items-center gap-4 text-sm text-gray-400">
            <a href="/" className="hover:text-gray-100">Home</a>
            <a href="/privacy" className="hover:text-gray-100">Privacy</a>
          </nav>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10">
        <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
        <p className="text-sm text-gray-500 mb-8">Effective Date: May 1, 2025</p>

        <section className="space-y-6 text-sm leading-relaxed text-gray-300">
          <p>
            These Terms of Service ("Terms") govern your access to and use of FetchLab (the "Service"), an API
            development and testing platform. By creating an account or otherwise using the Service, you
            ("you" or "Customer") agree to be bound by these Terms. If you do not agree, do not use the
            Service.
          </p>

          <div>
            <h2 className="text-xl font-semibold text-gray-100 mb-2">1. The Service</h2>
            <p>
              FetchLab provides tools for designing, sending, debugging, and documenting HTTP and WebSocket
              API requests, including request collections, environment management, scripted tests, AI-assisted
              authoring, OpenAPI generation, performance benchmarking, and team collaboration features.
              Specific features may change over time.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-gray-100 mb-2">2. Accounts and Eligibility</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>You must be at least 13 years old, and old enough in your jurisdiction to form a binding contract.</li>
              <li>You are responsible for safeguarding your password and any API keys you store in FetchLab.</li>
              <li>You are responsible for all activity that occurs under your account, including activity by team members you invite.</li>
              <li>You must promptly notify us of any unauthorized use of your account.</li>
            </ul>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-gray-100 mb-2">3. Trial Terms</h2>
            <p>
              New accounts receive a 7-day free trial with full access to paid features. No credit card is
              required to start a trial. At the end of the trial, you may continue on a free tier with reduced
              feature access or subscribe to a paid plan. We may modify trial terms for future signups at any
              time.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-gray-100 mb-2">4. Acceptable Use</h2>
            <p>You agree not to use the Service to:</p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li>Violate any applicable law, regulation, or third-party right.</li>
              <li>Send requests to systems you do not have permission to test or access.</li>
              <li>
                Conduct denial-of-service attacks, mass credential testing, scraping in violation of a target's
                terms, or any activity intended to disrupt or compromise third-party systems.
              </li>
              <li>Upload or transmit malware, exploits, or other harmful code.</li>
              <li>Reverse engineer, decompile, or attempt to derive source code of the Service, except to the extent expressly permitted by law.</li>
              <li>Use the Service to build a competing product or to benchmark for the purpose of publication without our prior written consent.</li>
              <li>Resell or sublicense the Service without our prior written agreement.</li>
            </ul>
            <p className="mt-2">
              We may suspend or terminate accounts that violate this section, with or without notice.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-gray-100 mb-2">5. Your Content and Data</h2>
            <p>
              You retain all rights to the data you create or upload to the Service — including request
              definitions, collections, environments, scripts, responses, and any keys or credentials you
              store ("Customer Data"). You grant FetchLab a limited license to host, process, and transmit
              Customer Data solely to operate and improve the Service for you. We do not use Customer Data to
              train models or for advertising.
            </p>
            <p className="mt-2">
              You represent and warrant that you have the rights necessary to submit Customer Data to the
              Service and that doing so does not violate any third-party terms or applicable law.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-gray-100 mb-2">6. Our Intellectual Property</h2>
            <p>
              FetchLab and all related software, designs, trademarks, and documentation are the property of
              FetchLab and its licensors. Except for the limited rights granted to use the Service under these
              Terms, no rights are transferred to you. The name "FetchLab", the FetchLab logo, and related
              marks are trademarks of FetchLab. You may not use them without our written permission.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-gray-100 mb-2">7. Third-Party Services</h2>
            <p>
              The Service can connect to third-party services you configure (LLM providers, OAuth providers,
              SSO identity providers, target APIs). FetchLab is not responsible for those services, their
              availability, or their handling of your data. Your use of third-party services is governed by
              their respective terms and privacy policies.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-gray-100 mb-2">8. Fees</h2>
            <p>
              Paid plans are billed in advance on the cadence stated at the time of purchase. Fees are
              non-refundable except where required by law. We may change pricing on prospective billing
              periods with reasonable notice.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-gray-100 mb-2">9. Disclaimers</h2>
            <p className="uppercase">
              The Service is provided "as is" and "as available," without warranties of any kind, whether
              express, implied, or statutory, including warranties of merchantability, fitness for a particular
              purpose, title, and non-infringement. We do not warrant that the Service will be uninterrupted,
              error-free, or secure, or that any defects will be corrected.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-gray-100 mb-2">10. Limitation of Liability</h2>
            <p className="uppercase">
              To the maximum extent permitted by law, FetchLab and its affiliates, officers, employees, and
              agents will not be liable for any indirect, incidental, special, consequential, exemplary, or
              punitive damages, or for any loss of profits, revenue, data, or goodwill, arising out of or
              relating to your use of the Service, even if advised of the possibility of such damages. Our
              total aggregate liability for any claim arising out of or relating to these Terms or the Service
              will not exceed the greater of (a) the amounts you paid us for the Service in the twelve months
              preceding the event giving rise to the claim, or (b) one hundred U.S. dollars ($100).
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-gray-100 mb-2">11. Indemnification</h2>
            <p>
              You agree to defend, indemnify, and hold harmless FetchLab from and against any claims, damages,
              liabilities, and expenses (including reasonable attorneys' fees) arising out of (a) your use of
              the Service in violation of these Terms or applicable law, or (b) your Customer Data or the
              targets you direct the Service to test.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-gray-100 mb-2">12. Termination</h2>
            <p>
              You may stop using the Service and delete your account at any time. We may suspend or terminate
              your access to the Service for any breach of these Terms or for activity that risks harm to
              FetchLab, other users, or third parties. Upon termination, your right to use the Service ceases;
              Sections 5–6 and 9–14 survive termination.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-gray-100 mb-2">13. Governing Law and Venue</h2>
            <p>
              These Terms are governed by the laws of the State of Texas, USA, without regard to its conflict
              of laws principles. Any dispute arising out of or relating to these Terms or the Service will be
              brought exclusively in the state or federal courts located in Travis County, Texas, and each
              party consents to personal jurisdiction and venue there.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-gray-100 mb-2">14. Changes to These Terms</h2>
            <p>
              We may modify these Terms from time to time. Material changes will be communicated through the
              Service or by email. Continued use of the Service after the effective date of a change
              constitutes acceptance of the updated Terms.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-gray-100 mb-2">15. Miscellaneous</h2>
            <p>
              These Terms constitute the entire agreement between you and FetchLab regarding the Service. If
              any provision is held to be unenforceable, the remainder will remain in full effect. Failure to
              enforce any provision is not a waiver of that provision. You may not assign these Terms without
              our prior written consent; we may assign them in connection with a merger, acquisition, or sale
              of assets.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-gray-100 mb-2">16. Contact</h2>
            <p>
              Questions about these Terms can be directed to{' '}
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
