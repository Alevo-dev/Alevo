import type { Metadata } from "next";
import { PageHead, Section, Prose } from "@/components/landing/page-kit";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Alevo collects, uses, shares and protects personal information.",
};

export default function PrivacyPage() {
  return (
    <>
      <PageHead eyebrow="LEGAL" title="Privacy Policy" subtitle="Last updated: September 2026" />
      <Section style={{ paddingTop: 32 }}>
        <Prose>
          <p>This Privacy Policy explains how Alevo (&ldquo;Alevo&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;) collects, uses, shares and protects information when you visit getalevo.com, contact us, or use our services. By using the site or services, you agree to this policy.</p>

          <h2>Information we collect</h2>
          <ul>
            <li><strong>Information you provide:</strong> your name, work email, company, and any message or details you submit through our forms or when booking a demo.</li>
            <li><strong>Usage data:</strong> pages visited, referring links, device and browser type, and similar analytics collected automatically.</li>
            <li><strong>Cookies:</strong> small files used to keep the site working, remember preferences (such as your theme), and measure traffic.</li>
            <li><strong>Customer data:</strong> where you use Alevo as a customer, data from the tools you connect (such as your CRM, calendar and communication channels) is processed to provide the service under your instructions.</li>
          </ul>

          <h2>How we use information</h2>
          <ul>
            <li>To respond to your enquiries and schedule and run demos.</li>
            <li>To provide, maintain, secure and improve our website and services.</li>
            <li>To send service and, where permitted, marketing communications you can opt out of at any time.</li>
            <li>To comply with legal obligations and enforce our terms.</li>
          </ul>

          <h2>How we share information</h2>
          <p>We do not sell your personal information. We share it only with service providers who process it on our behalf (for example hosting, analytics, email and scheduling providers), when required by law, or in connection with a business transfer. Providers are bound to use the information only to perform services for us.</p>

          <h2>Data retention</h2>
          <p>We keep personal information only as long as needed for the purposes described here, to comply with our legal obligations, resolve disputes and enforce agreements, then delete or anonymize it.</p>

          <h2>Your rights</h2>
          <p>Depending on your location, you may have the right to access, correct, delete, or port your personal information, and to object to or restrict certain processing. To exercise these rights, contact us using the details below.</p>

          <h2>International transfers</h2>
          <p>We may process and store information in countries other than your own. Where we transfer personal information internationally, we use appropriate safeguards as required by applicable law.</p>

          <h2>Security</h2>
          <p>We use technical and organizational measures designed to protect personal information. See our <a href="/security">Security</a> page for more.</p>

          <h2>Children</h2>
          <p>Our services are intended for businesses and are not directed to children under 16. We do not knowingly collect information from children.</p>

          <h2>Changes</h2>
          <p>We may update this policy from time to time. Material changes will be posted on this page with an updated date.</p>

          <h2>Contact</h2>
          <p>Questions about this policy? Email <a href="mailto:privacy@getalevo.com">privacy@getalevo.com</a>.</p>
        </Prose>
      </Section>
    </>
  );
}
