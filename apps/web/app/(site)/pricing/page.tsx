import type { Metadata } from "next";
import { PageHead, Section, CtaBand } from "@/components/landing/page-kit";
import { PricingCards } from "@/components/landing/pricing-cards";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Plans that scale with your pipeline — inbound answering, outbound sequences and calling. Every paid plan starts with a 90-day free trial.",
};

export default function PricingPage() {
  return (
    <>
      <PageHead
        eyebrow="Pricing"
        title="Plans that scale with your pipeline."
        subtitle="Start with a 90-day free trial on any paid plan. Upgrade when Alevo is already booking meetings for you."
      />
      <Section style={{ paddingTop: 40 }}>
        <PricingCards />
      </Section>
      <CtaBand title="Not sure which plan fits?" subtitle="Tell us your volume and we’ll point you to the right tier in a 20-minute demo." />
    </>
  );
}
