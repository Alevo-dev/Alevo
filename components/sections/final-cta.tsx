import { ArrowRight } from "lucide-react";
import { CtaButton } from "@/components/marketing/cta-button";
import { FadeIn } from "@/components/motion/motion-primitives";
import { finalCta } from "@/content/copy";

export function FinalCta() {
  return (
    <section className="section-y">
      <div className="container-page">
        <FadeIn>
          <div className="relative overflow-hidden rounded-[2.5rem] border border-border px-6 py-16 text-center sm:px-16 sm:py-20">
            <div
              aria-hidden
              className="absolute inset-0 [background-image:var(--brand-gradient)] opacity-[0.14]"
            />
            <div className="brand-aura absolute inset-x-0 -bottom-1/3 h-full opacity-70" aria-hidden />
            <div className="relative mx-auto flex max-w-2xl flex-col items-center gap-6">
              <h2 className="font-display text-3xl font-semibold text-balance sm:text-4xl">
                {finalCta.title}
              </h2>
              <p className="text-muted-foreground" style={{ fontSize: "var(--text-lead)" }}>
                {finalCta.subtitle}
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <CtaButton href={finalCta.primaryCta.href}>
                  {finalCta.primaryCta.label}
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </CtaButton>
                <CtaButton href={finalCta.secondaryCta.href} variant="secondary">
                  {finalCta.secondaryCta.label}
                </CtaButton>
              </div>
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
