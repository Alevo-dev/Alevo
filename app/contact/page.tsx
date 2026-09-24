import type { Metadata } from "next";
import { CalendarClock, MessageSquareHeart, ShieldCheck } from "lucide-react";
import { Eyebrow } from "@/components/marketing/section-heading";
import { FadeIn } from "@/components/motion/motion-primitives";
import { ContactForm } from "@/components/sections/contact-form";
import { contactPage } from "@/content/copy";

export const metadata: Metadata = {
  title: "Book a demo",
  description: contactPage.subtitle,
};

const points = [
  {
    icon: CalendarClock,
    title: "20 minutes, no deck",
    body: "Just your use case, running live.",
  },
  {
    icon: MessageSquareHeart,
    title: "Talk to a human",
    body: "A real person who's carried a quota — not a bot.",
  },
  {
    icon: ShieldCheck,
    title: "No pressure",
    body: "See it work, then decide. We'll never spam you.",
  },
];

export default function ContactPage() {
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="brand-aura absolute -top-32 left-1/4 h-[50vh] w-[60vw] opacity-60"
      />
      <div className="container-page relative grid gap-12 pt-20 pb-24 lg:grid-cols-2 lg:gap-16 lg:pt-28">
        <div className="flex flex-col gap-6">
          <FadeIn>
            <Eyebrow>{contactPage.eyebrow}</Eyebrow>
          </FadeIn>
          <FadeIn delay={0.05}>
            <h1
              className="font-display font-semibold tracking-tight text-balance"
              style={{ fontSize: "var(--text-h1)", lineHeight: 1.05 }}
            >
              {contactPage.title}
            </h1>
          </FadeIn>
          <FadeIn delay={0.1}>
            <p
              className="max-w-md text-muted-foreground"
              style={{ fontSize: "var(--text-lead)", lineHeight: 1.55 }}
            >
              {contactPage.subtitle}
            </p>
          </FadeIn>

          <FadeIn delay={0.15}>
            <ul className="mt-2 flex flex-col gap-5">
              {points.map((p) => (
                <li key={p.title} className="flex items-start gap-3.5">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl [background-image:var(--brand-gradient-soft)] text-brand-violet ring-1 ring-border">
                    <p.icon className="size-5" />
                  </span>
                  <div>
                    <div className="font-medium">{p.title}</div>
                    <div className="text-sm text-muted-foreground">{p.body}</div>
                  </div>
                </li>
              ))}
            </ul>
          </FadeIn>
        </div>

        <FadeIn from="up" delay={0.1}>
          <ContactForm />
        </FadeIn>
      </div>
    </section>
  );
}
