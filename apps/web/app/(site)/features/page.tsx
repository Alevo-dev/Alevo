import type { Metadata } from "next";
import { PageHeader } from "@/components/marketing/page-header";
import { Channels } from "@/components/sections/channels";
import { Features } from "@/components/sections/features";
import { HowItWorks } from "@/components/sections/how-it-works";
import { Stats } from "@/components/sections/stats";
import { FinalCta } from "@/components/sections/final-cta";

export const metadata: Metadata = {
  title: "Features",
  description:
    "One AI rep across email, forms, calls, and chat — that sounds like your best rep and knows when to bring in a human.",
};

export default function FeaturesPage() {
  return (
    <>
      <PageHeader
        eyebrow="Features"
        title={<>One rep. Every channel. Zero busywork.</>}
        subtitle="Alevo works your pipeline end to end — writing, replying, calling, and booking — with the judgment to know when a human should step in."
      />
      <Channels />
      <Features />
      <HowItWorks />
      <Stats />
      <FinalCta />
    </>
  );
}
