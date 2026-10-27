import type { Metadata } from "next";
import { PageHead, Section, Prose } from "@/components/landing/page-kit";
import { legal } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Alevo collects, uses, shares and protects personal information.",
};

/** Service providers that process personal information on our behalf. */
const SUBPROCESSORS: [string, string][] = [
  ["Vercel", "website and app hosting"],
  ["Supabase", "database"],
  ["Clerk", "sign-in and account management"],
  ["Cloudflare R2", "file and call-recording storage"],
  ["Anthropic", "AI model that drafts replies and qualifies leads"],
  ["Voyage AI", "search embeddings for customer knowledge bases"],
  ["Resend", "sending and receiving email"],
  ["Twilio", "SMS and phone numbers"],
  ["Vapi and Deepgram", "voice calls and transcription"],
  ["Inngest", "background job processing"],
  ["Sentry", "error monitoring"],
  ["Slack, Google, Microsoft, Cal.com, Calendly", "only when a customer connects them"],
];

export default function PrivacyPage() {
  return (
    <>
      <PageHead eyebrow="LEGAL" title="Privacy Policy" subtitle={`Last updated: ${legal.lastUpdated}`} />
      <Section style={{ paddingTop: 32 }}>
        <Prose>
          <p>This Privacy Policy explains how Alevo (&ldquo;Alevo&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;) collects, uses, shares and protects information when you visit getalevo.com, contact us, or use our services. By using the site or services, you agree to this policy.</p>

          <h2>Information we collect</h2>
          <ul>
            <li><strong>Information you provide:</strong> your name, work email, company, and any message or details you submit through our forms or when booking a demo.</li>
            <li><strong>Usage data:</strong> pages visited, referring links, device and browser type, and similar analytics collected automatically.</li>
            <li><strong>Cookies and browser storage:</strong> used to keep the app working (sign-in) and remember preferences such as your theme. We run no analytics or advertising cookies today. See the <a href="/cookies">Cookie Policy</a>.</li>
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
          <p>We do not sell your personal information. We share it only with the service providers below, who process it on our behalf and are bound to use it only to perform services for us, when required by law, or in connection with a business transfer.</p>
          <ul>
            {SUBPROCESSORS.map(([name, purpose]) => (
              <li key={name}><strong>{name}:</strong> {purpose}.</li>
            ))}
          </ul>
          <p>We review this list when we add or remove a provider and update this page.</p>

          <h2>Data retention</h2>
          <p>We keep personal information only as long as needed for the purposes described here, to comply with our legal obligations, resolve disputes and enforce agreements, then delete or anonymize it.</p>

          <h2>Your rights</h2>
          <p>Depending on your location, you may have the right to access, correct, delete, or port your personal information, and to object to or restrict certain processing.</p>

          <h2>Requesting a copy or deletion of your data</h2>
          <ul>
            <li><strong>If you are an Alevo customer:</strong> you can delete your own account from the account menu in the app, and a workspace owner can delete the whole workspace from the workspace menu. Both remove the data permanently from our systems.</li>
            <li><strong>If a business using Alevo contacted you</strong> (by email, text or phone): that business decides how your information is used and Alevo processes it on their behalf. Reply to any message from them to ask for a copy or deletion, or email us at <a href={`mailto:${legal.email.privacy}`}>{legal.email.privacy}</a> and we will pass the request to them and make sure it is actioned. Every email we send also has an unsubscribe link, and texting STOP ends text messages.</li>
            <li><strong>If you visited our website or booked a demo:</strong> email <a href={`mailto:${legal.email.privacy}`}>{legal.email.privacy}</a>.</li>
          </ul>
          <p>We respond within 30 days and may ask you to confirm your identity first.</p>

          <h2>International transfers</h2>
          <p>We may process and store information in countries other than your own. Where we transfer personal information internationally, we use appropriate safeguards as required by applicable law.</p>

          <h2>Security</h2>
          <p>We use technical and organizational measures designed to protect personal information. See our <a href="/security">Security</a> page for more.</p>

          <h2>Children</h2>
          <p>Our services are intended for businesses and are not directed to children under 16. We do not knowingly collect information from children.</p>

          <h2>Changes</h2>
          <p>We may update this policy from time to time. Material changes will be posted on this page with an updated date.</p>

          <h2>Contact</h2>
          <p>This policy is issued by {legal.name}{legal.address ? `, ${legal.address}` : ""}. Questions? Email <a href={`mailto:${legal.email.privacy}`}>{legal.email.privacy}</a>{legal.phone ? ` or call ${legal.phone}` : ""}.</p>
        </Prose>
      </Section>
    </>
  );
}
