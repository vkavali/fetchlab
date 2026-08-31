import LegalLayout from './LegalLayout';

export default function TermsOfService() {
  return (
    <LegalLayout title="Terms of Service" effective="May 2025">
      <p>
        These Terms of Service (&ldquo;Terms&rdquo;) govern your access to and use of FetchLab
        (&ldquo;FetchLab,&rdquo; &ldquo;we,&rdquo; &ldquo;our&rdquo;). By creating an account or
        using the service, you agree to these Terms.
      </p>

      <section>
        <h2 className="text-base font-semibold text-white mb-2">1. The service</h2>
        <p>
          FetchLab is an API testing workspace that lets you compose, send, and inspect HTTP
          requests, organize them into collections, and collaborate with team members. Specific
          features may be added, removed, or changed over time.
        </p>
      </section>

      <section>
        <h2 className="text-base font-semibold text-white mb-2">2. Accounts</h2>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>You must provide accurate registration information and keep it up to date.</li>
          <li>You are responsible for safeguarding your password and any actions taken under your account.</li>
          <li>You must be at least 16 years old to use FetchLab.</li>
          <li>You must notify us promptly if you suspect unauthorized access to your account.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-base font-semibold text-white mb-2">3. Free trial</h2>
        <p>
          New accounts include a <strong className="text-white font-medium">30-day free trial</strong>{' '}
          of paid features. No credit card is required to start. When the trial ends, your account
          reverts to the free tier unless you choose to subscribe. We will not charge you without
          your explicit consent.
        </p>
      </section>

      <section>
        <h2 className="text-base font-semibold text-white mb-2">4. Acceptable use</h2>
        <p>You agree not to use FetchLab to:</p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>send traffic that violates applicable law or third-party rights;</li>
          <li>send unsolicited traffic, perform denial-of-service attacks, or otherwise abuse third-party APIs;</li>
          <li>reverse-engineer, scrape, or attempt to extract source code or secrets from the service;</li>
          <li>resell or sublicense the service without our written permission;</li>
          <li>upload malware, viruses, or other harmful code.</li>
        </ul>
        <p className="mt-3">
          We may suspend or terminate accounts that violate these rules or that put the integrity of the service at risk.
        </p>
      </section>

      <section>
        <h2 className="text-base font-semibold text-white mb-2">5. Your data</h2>
        <p>
          <strong className="text-white font-medium">You own the data you put into FetchLab</strong>
          {' '}— your requests, collections, environments, scripts, and team content. You grant us a
          limited license to host and process that data solely to operate the service for you. We
          claim no rights to your data beyond what is needed to provide the service.
        </p>
      </section>

      <section>
        <h2 className="text-base font-semibold text-white mb-2">6. Our platform</h2>
        <p>
          <strong className="text-white font-medium">FetchLab owns the platform</strong> — the
          software, branding, documentation, and underlying infrastructure. These Terms do not grant
          you any rights to our trademarks or other intellectual property except the limited right to
          use the service while these Terms are in effect.
        </p>
      </section>

      <section>
        <h2 className="text-base font-semibold text-white mb-2">7. Third-party services</h2>
        <p>
          FetchLab can connect to third-party services (for example, an LLM provider you configure
          with your own API key, or integrations such as Slack). Your use of those services is
          governed by their own terms and privacy policies. We are not responsible for third-party
          services, and your data flowing to them is subject to their handling.
        </p>
      </section>

      <section>
        <h2 className="text-base font-semibold text-white mb-2">8. Service availability</h2>
        <p>
          We work to keep the service available and reliable, but we do not guarantee uninterrupted
          access. We may schedule maintenance, ship changes, or experience outages. We will give
          reasonable notice of planned downtime when we can.
        </p>
      </section>

      <section>
        <h2 className="text-base font-semibold text-white mb-2">9. Disclaimer of warranties</h2>
        <p>
          The service is provided <strong className="text-white font-medium">&ldquo;as is&rdquo;</strong> and
          <strong className="text-white font-medium"> &ldquo;as available&rdquo;</strong>. To the
          fullest extent permitted by law, FetchLab disclaims all warranties, express or implied,
          including merchantability, fitness for a particular purpose, and non-infringement.
        </p>
      </section>

      <section>
        <h2 className="text-base font-semibold text-white mb-2">10. Limitation of liability</h2>
        <p>
          To the maximum extent permitted by law, FetchLab and its contributors will not be liable
          for any indirect, incidental, special, consequential, or punitive damages, or for any loss
          of profits, revenue, data, or goodwill, arising out of or related to your use of the
          service. Our total aggregate liability for any claim arising out of these Terms will not
          exceed the greater of (a) the amount you paid us in the twelve months preceding the claim
          or (b) US $100.
        </p>
      </section>

      <section>
        <h2 className="text-base font-semibold text-white mb-2">11. Indemnification</h2>
        <p>
          You agree to indemnify and hold FetchLab harmless from any claim or demand arising out of
          your misuse of the service or your violation of these Terms or applicable law.
        </p>
      </section>

      <section>
        <h2 className="text-base font-semibold text-white mb-2">12. Termination</h2>
        <p>
          You can stop using the service and delete your account at any time. We may suspend or
          terminate your access for breach of these Terms or to comply with legal requirements. On
          termination, sections that by their nature should survive (ownership, disclaimers,
          limitations of liability, indemnification, governing law) will survive.
        </p>
      </section>

      <section>
        <h2 className="text-base font-semibold text-white mb-2">13. Governing law</h2>
        <p>
          These Terms are governed by the laws of the State of Texas, United States, without regard
          to its conflict-of-laws principles. The state and federal courts located in Texas have
          exclusive jurisdiction over any disputes, except where applicable law gives you the right
          to bring proceedings in your country of residence.
        </p>
      </section>

      <section>
        <h2 className="text-base font-semibold text-white mb-2">14. Changes to these Terms</h2>
        <p>
          We may update these Terms from time to time. If we make material changes, we will update
          the effective date above and notify active account holders by email at least 14 days
          before the change takes effect. Continued use of the service after that date constitutes
          acceptance of the updated Terms.
        </p>
      </section>

      <section>
        <h2 className="text-base font-semibold text-white mb-2">15. Contact</h2>
        <p>
          Questions about these Terms can be sent to{' '}
          <a href="mailto:vkavali10@gmail.com" className="text-[#10b981] hover:underline">
            vkavali10@gmail.com
          </a>
          .
        </p>
      </section>
    </LegalLayout>
  );
}
