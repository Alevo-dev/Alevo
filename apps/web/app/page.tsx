import { Hero } from "@/components/sections/hero";
import { LogoCloud } from "@/components/sections/logo-cloud";
import { Channels } from "@/components/sections/channels";
import { Features } from "@/components/sections/features";
import { HowItWorks } from "@/components/sections/how-it-works";
import { Stats } from "@/components/sections/stats";
import { Testimonials } from "@/components/sections/testimonials";
import { PricingTable } from "@/components/sections/pricing-table";
import { FinalCta } from "@/components/sections/final-cta";

export default function Home() {
  return (
    <>
      <Hero />
      <LogoCloud />
      <Channels />
      <Features />
      <HowItWorks />
      <Stats />
      <Testimonials />
      <PricingTable />
      <FinalCta />
    </>
  );
}
