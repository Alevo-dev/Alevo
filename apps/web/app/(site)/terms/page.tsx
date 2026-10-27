import type { Metadata } from "next";
import { PageHead, Section, Prose } from "@/components/landing/page-kit";
import { legal } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms that govern your use of the Alevo website and services.",
};

export default function TermsPage() {
  return (
    <>
      <PageHead eyebrow="LEGAL" title="Terms of Service" subtitle={`Last updated: ${legal.lastUpdated}`} />
      <Section style={{ paddingTop: 32 }}>
        <Prose>
          <p>These Terms of Service (&ldquo;Terms&rdquo;) govern your access to and use of the Alevo website and services (the &ldquo;Services&rdquo;). By using the Services you agree to these Terms. If you are using the Services on behalf of an organization, you agree on its behalf.</p>

          <h2>Use of the Services</h2>
          <p>You may use the Services only in compliance with these Terms and all applicable laws. You are responsible for your account, your users, and the data you connect to or process with the Services. You agree not to misuse the Services, interfere with their operation, or attempt to access them by unauthorized means.</p>

          <h2>Trials, billing and cancellation</h2>
          <p>Every paid plan starts with a {legal.trialDays}-day free trial. You are not charged during the trial; billing starts when it ends unless you cancel first. Fees are billed in advance, monthly or annually, at the price shown when you subscribe. You can cancel at any time and keep access until the end of the paid period. Fees already paid are non-refundable except where required by law. Our <a href="/refunds">Refund Policy</a> has the details. We may change pricing on renewal with prior notice. Taxes are your responsibility unless we are required to collect them.</p>

          <h2>Plan allowances and overage</h2>
          <p>Each plan includes monthly allowances (for example AI conversations, voice minutes and emails) shown on the <a href="/pricing">Pricing</a> page. When an allowance is reached, the related activity pauses until the next period or until you upgrade. Nothing beyond your plan price is charged unless you turn on overage in your workspace, in which case usage past the allowance is billed at the published overage rates, up to the monthly cap you set.</p>

          <h2>Acceptable use</h2>
          <p>You must have all necessary rights and consents for the contacts and data you use with the Services, and you must comply with applicable communications, marketing and privacy laws (including rules on calls, messaging and email). You are responsible for the content of communications sent through the Services on your behalf.</p>

          <h2>Customer data</h2>
          <p>You retain ownership of the data you provide. You grant us the rights needed to operate and improve the Services and to act on your instructions. Our handling of personal information is described in our <a href="/privacy">Privacy Policy</a>.</p>

          <h2>Intellectual property</h2>
          <p>The Services, including all related software, content and trademarks, are owned by Alevo or its licensors and are protected by law. These Terms do not grant you any rights to our intellectual property except the limited right to use the Services.</p>

          <h2>Disclaimers</h2>
          <p>The Services are provided &ldquo;as is&rdquo; without warranties of any kind, to the maximum extent permitted by law. We do not warrant that the Services will be uninterrupted, error-free or that outcomes (such as meetings booked) will meet your expectations.</p>

          <h2>Limitation of liability</h2>
          <p>To the maximum extent permitted by law, Alevo will not be liable for indirect, incidental, special or consequential damages, or for lost profits or revenues. Our total liability for any claim will not exceed the amounts you paid us for the Services in the twelve months before the claim.</p>

          <h2>Termination</h2>
          <p>You may stop using the Services at any time. We may suspend or terminate access if you breach these Terms or to protect the Services. Provisions that by their nature should survive termination will survive.</p>

          <h2>Changes</h2>
          <p>We may update these Terms from time to time. Material changes will be posted on this page with an updated date, and continued use of the Services means you accept the updated Terms.</p>

          <h2>Who you are contracting with</h2>
          <p>The Services are provided by {legal.name}{legal.address ? `, ${legal.address}` : ""}.</p>

          <h2>Contact</h2>
          <p>Questions about these Terms? Email <a href={`mailto:${legal.email.legal}`}>{legal.email.legal}</a>{legal.phone ? ` or call ${legal.phone}` : ""}.</p>
        </Prose>
      </Section>
    </>
  );
}
