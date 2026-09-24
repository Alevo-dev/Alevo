import type { Metadata } from "next";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { PageHeader } from "@/components/marketing/page-header";
import { SectionHeading } from "@/components/marketing/section-heading";
import { PricingTable } from "@/components/sections/pricing-table";
import { FinalCta } from "@/components/sections/final-cta";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Simple, honest pricing — pay for meetings, not seats. Start free and upgrade when Alevo has earned it.",
};

const faqs = [
  {
    q: "Do I need a credit card to start?",
    a: "No. The Starter plan is free forever and needs no card. Add one only when you're ready to scale.",
  },
  {
    q: "What counts as a “lead”?",
    a: "A unique person Alevo engages in a given month — across any channel. Re-engaging the same person later in the month doesn't count twice.",
  },
  {
    q: "Can Alevo really hand off to a human?",
    a: "Yes. You set the line, and the moment a lead crosses it, Alevo pulls in the right teammate with the full conversation and context.",
  },
  {
    q: "How long does setup take?",
    a: "Most teams are live the same afternoon — connect your inbox, CRM, and calendar, drop in a few winning threads, and set your guardrails.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Always. No annual lock-in on monthly plans, and you keep access through the end of your billing period.",
  },
];

export default function PricingPage() {
  return (
    <>
      <PageHeader
        eyebrow="Pricing"
        title={<>Pay for meetings, not seats.</>}
        subtitle="Start free. Upgrade when Alevo has already booked its keep. Cancel whenever — no annual handcuffs."
      />
      <PricingTable showHeading={false} />

      <section className="section-y bg-muted/30">
        <div className="container-page flex flex-col gap-12">
          <SectionHeading title="Questions, answered." />
          <div className="mx-auto w-full max-w-3xl">
            <Accordion multiple={false} className="w-full">
              {faqs.map((f, i) => (
                <AccordionItem key={i} value={`item-${i}`}>
                  <AccordionTrigger className="text-left font-display text-lg">
                    {f.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    {f.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      </section>

      <FinalCta />
    </>
  );
}
