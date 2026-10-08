import type { Metadata } from "next";
import { PageHead, Section, Prose } from "@/components/landing/page-kit";

export const metadata: Metadata = {
  title: "Security",
  description: "How Alevo protects your data — encryption, access controls, monitoring and compliance.",
};

export default function SecurityPage() {
  return (
    <>
      <PageHead eyebrow="TRUST" title="Security at Alevo" subtitle="How we protect your data and your customers’ data." />
      <Section style={{ paddingTop: 32 }}>
        <Prose>
          <p>Security is foundational to how we build Alevo. Because the Services connect to your CRM, calendar and communication channels, we treat that trust seriously and apply layered protections across our infrastructure, applications and operations.</p>

          <h2>Encryption</h2>
          <p>Data is encrypted in transit using TLS, and data at rest is encrypted using industry-standard algorithms. Secrets and credentials for connected integrations are stored using dedicated secret management.</p>

          <h2>Access control</h2>
          <p>Access to production systems and customer data is limited to authorized personnel on a least-privilege basis, protected by single sign-on and multi-factor authentication, and logged for review.</p>

          <h2>Infrastructure</h2>
          <p>Alevo runs on reputable cloud providers with strong physical and network security. Environments are segregated, and we use automated monitoring and alerting to detect and respond to anomalies.</p>

          <h2>Reliability &amp; recovery</h2>
          <p>We maintain backups and disaster-recovery practices designed to keep the Services available and to restore data in the event of an incident.</p>

          <h2>Data handling</h2>
          <p>We process customer data under your instructions and only as needed to provide the Services. Our handling of personal information is described in our <a href="/privacy">Privacy Policy</a>. Enterprise plans include options such as SSO/SAML, role-based access, audit logs and data-residency choices.</p>

          <h2>Compliance</h2>
          <p>We align our program with recognized standards and pursue independent assessments (such as SOC 2) as we grow. Enterprise customers can request current reports and documentation.</p>

          <h2>Reporting a vulnerability</h2>
          <p>If you believe you&rsquo;ve found a security issue, please email <a href="mailto:security@getalevo.com">security@getalevo.com</a>. We investigate all reports and appreciate responsible disclosure.</p>
        </Prose>
      </Section>
    </>
  );
}
