"use client";

import { useState } from "react";
import { Check, Gift } from "lucide-react";
import { cn } from "cn";
import { SectionHeading } from "@/components/marketing/section-heading";
import { CtaButton } from "@/components/marketing/cta-button";
import { pricing } from "@/content/copy";

export function PricingTable({ showHeading = true }: { showHeading?: boolean }) {
  const [annual, setAnnual] = useState(false);

  return (
    <section id="pricing" className="section-y">
      <div className="container-page flex flex-col gap-12">
        {showHeading ? (
          <SectionHeading
            eyebrow={pricing.eyebrow}
            title={pricing.title}
            subtitle={pricing.subtitle}
          />
        ) : null}

        {/* Billing toggle */}
        <div className="flex items-center justify-center gap-4">
          <span
            className={cn(
              "text-sm font-medium transition-colors",
              !annual ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {pricing.monthlyLabel}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={annual}
            aria-label="Toggle annual billing"
            onClick={() => setAnnual((v) => !v)}
            className="relative h-7 w-12 cursor-pointer rounded-full bg-muted ring-1 ring-border transition-colors data-[on=true]:bg-primary"
            data-on={annual}
          >
            <span
              className={cn(
                "absolute top-1 left-1 size-5 rounded-full bg-background shadow-sm transition-transform",
                annual && "translate-x-5",
              )}
            />
          </button>
          <span
            className={cn(
              "flex items-center gap-2 text-sm font-medium transition-colors",
              annual ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {pricing.annualLabel}
            <span className="rounded-full [background-image:var(--brand-gradient-soft)] px-2 py-0.5 text-xs text-brand-violet">
              {pricing.annualNote}
            </span>
          </span>
        </div>

        <div className="grid items-stretch gap-6 lg:grid-cols-3">
          {pricing.tiers.map((tier) => {
            const price = annual ? tier.priceAnnual : tier.priceMonthly;
            return (
              <article
                key={tier.name}
                className={cn(
                  "relative flex flex-col rounded-[1.75rem] border p-8 transition-all",
                  tier.highlighted
                    ? "border-transparent bg-card shadow-(--shadow-lift) ring-2 ring-primary"
                    : "border-border bg-card",
                )}
              >
                {tier.highlighted ? (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full [background-image:var(--brand-gradient)] px-3 py-1 text-xs font-medium text-white">
                    Most popular
                  </span>
                ) : null}

                <h3 className="font-display text-xl font-semibold">
                  {tier.name}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {tier.blurb}
                </p>

                <div className="mt-6 flex items-end gap-1">
                  {price === null ? (
                    <span className="font-display text-4xl font-semibold">
                      Custom
                    </span>
                  ) : (
                    <>
                      <span className="font-display text-4xl font-semibold">
                        ${price.toLocaleString("en-US")}
                      </span>
                      <span className="pb-1 text-sm text-muted-foreground">
                        /mo{annual ? ", billed yearly" : ""}
                      </span>
                    </>
                  )}
                </div>

                <ul className="mt-7 flex flex-1 flex-col gap-3">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm">
                      <Check className="mt-0.5 size-4 shrink-0 text-brand-violet" />
                      <span className="text-foreground/90">{f}</span>
                    </li>
                  ))}
                </ul>

                <CtaButton
                  href={tier.cta.href}
                  variant={tier.highlighted ? "primary" : "secondary"}
                  className="mt-8 w-full"
                >
                  {tier.cta.label}
                </CtaButton>
              </article>
            );
          })}
        </div>

        <p className="mx-auto flex max-w-xl items-center justify-center gap-2 text-center text-sm text-muted-foreground">
          <Gift className="size-4 shrink-0 text-brand-violet" />
          {pricing.trialNote}
        </p>
      </div>
    </section>
  );
}
