import { ArrowRight } from "lucide-react";
import { HeroVisual } from "@/components/sections/hero-visual";
import { CtaButton } from "@/components/marketing/cta-button";
import { Eyebrow } from "@/components/marketing/section-heading";
import { FadeIn } from "@/components/motion/motion-primitives";
import { hero, channels } from "@/content/copy";

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* ambient brand aura */}
      <div
        aria-hidden
        className="brand-aura absolute -top-40 left-1/2 h-[70vh] w-[80vw] -translate-x-1/2 opacity-70"
      />

      <div className="container-page relative grid items-center gap-10 pt-16 pb-20 lg:grid-cols-[1.05fr_0.95fr] lg:pt-24 lg:pb-28">
        {/* Copy */}
        <div className="flex flex-col items-start gap-6">
          <FadeIn from="up">
            <Eyebrow>{hero.eyebrow}</Eyebrow>
          </FadeIn>

          <FadeIn from="up" delay={0.05}>
            <h1
              className="max-w-[15ch] font-display font-semibold tracking-tight"
              style={{ fontSize: "var(--text-display)", lineHeight: 1.02 }}
            >
              {hero.titleLead}{" "}
              <span className="text-gradient">{hero.titleAccent}</span>.
            </h1>
          </FadeIn>

          <FadeIn from="up" delay={0.1}>
            <p
              className="max-w-xl text-muted-foreground"
              style={{ fontSize: "var(--text-lead)", lineHeight: 1.55 }}
            >
              {hero.subtitle}
            </p>
          </FadeIn>

          <FadeIn from="up" delay={0.15}>
            <div className="flex flex-wrap items-center gap-3">
              <CtaButton href={hero.primaryCta.href}>
                {hero.primaryCta.label}
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </CtaButton>
              <CtaButton href={hero.secondaryCta.href} variant="secondary">
                {hero.secondaryCta.label}
              </CtaButton>
            </div>
          </FadeIn>

          <FadeIn from="up" delay={0.2}>
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">{hero.note}</p>
              <ul className="flex flex-wrap gap-2">
                {channels.items.map((c) => (
                  <li
                    key={c.id}
                    className="rounded-full border border-border bg-card/50 px-3 py-1 text-xs font-medium text-muted-foreground"
                  >
                    {c.name}
                  </li>
                ))}
              </ul>
            </div>
          </FadeIn>
        </div>

        {/* Live conversation cards */}
        <div className="relative w-full">
          <HeroVisual />
        </div>
      </div>
    </section>
  );
}
