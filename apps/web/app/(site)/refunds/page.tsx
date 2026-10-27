import type { Metadata } from "next";
import { PageHead, Section, Prose } from "@/components/landing/page-kit";
import { legal } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Refund Policy",
  description: "How trials, billing, cancellation and refunds work on Alevo.",
};

export default function RefundsPage() {
  return (
    <>
      <PageHead eyebrow="LEGAL" title="Refund Policy" subtitle={`Last updated: ${legal.lastUpdated}`} />
      <Section style={{ paddingTop: 32 }}>
        <Prose>
          <p>This policy explains how trials, billing, cancellation and refunds work for Alevo paid plans. It forms part of our <a href="/terms">Terms of Service</a>.</p>

          <h2>Free trial</h2>
          <p>Every paid plan starts with a {legal.trialDays}-day free trial. You are not charged during the trial. When it ends, billing starts on the plan you chose unless you cancel first. We send a reminder before the first charge.</p>

          <h2>Billing</h2>
          <p>Plans are billed in advance, monthly or annually, at the price shown on the <a href="/pricing">Pricing</a> page when you subscribe. Taxes are added where we are required to collect them. Price changes apply from your next renewal and we give you notice before they take effect.</p>

          <h2>Cancel anytime</h2>
          <p>You can cancel at any time from your workspace or by emailing <a href={`mailto:${legal.email.support}`}>{legal.email.support}</a>. Your plan stays active until the end of the period you have already paid for, and it is not renewed after that. You keep access to your data until then and can export it.</p>

          <h2>No refunds</h2>
          <p>Because every plan starts with a free trial, fees already paid are non-refundable. This includes partial months or years after you cancel, unused allowances, and downgrades mid-period. Where the law in your country gives you a right to a refund that we cannot exclude, that right applies.</p>

          <h2>Plan allowances and overage</h2>
          <p>Each plan includes a monthly allowance of AI conversations, voice minutes and emails. When you reach an allowance, Alevo pauses that activity and asks you to upgrade. Nothing is charged automatically. If you turn on overage in your workspace, usage past the allowance is billed at the published rates and capped at the monthly limit you set. Overage charges follow the same no-refund rule.</p>

          <h2>Billing mistakes</h2>
          <p>If you believe you were charged in error, such as a duplicate charge or a charge after a confirmed cancellation, contact us within 30 days of the charge and we will investigate and correct it.</p>

          <h2>Contact</h2>
          <p>Questions about billing or refunds? Email <a href={`mailto:${legal.email.support}`}>{legal.email.support}</a>.</p>
        </Prose>
      </Section>
    </>
  );
}
