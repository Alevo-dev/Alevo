import { SectionHeading } from "@/components/marketing/section-heading";
import { Stagger, StaggerItem } from "@/components/motion/motion-primitives";
import { howItWorks } from "@/content/copy";

export function HowItWorks() {
  return (
    <section id="how-it-works" className="section-y">
      <div className="container-page flex flex-col gap-14">
        <SectionHeading eyebrow={howItWorks.eyebrow} title={howItWorks.title} />

        <Stagger className="relative grid gap-6 md:grid-cols-3">
          {/* connecting line */}
          <div
            aria-hidden
            className="absolute top-8 right-[16%] left-[16%] hidden h-px [background-image:var(--brand-gradient)] opacity-30 md:block"
          />
          {howItWorks.steps.map((s) => (
            <StaggerItem key={s.n}>
              <article className="relative flex h-full flex-col gap-3 rounded-3xl border border-border bg-card p-7">
                <span className="grid size-16 place-items-center rounded-2xl bg-background font-display text-2xl font-semibold text-gradient ring-1 ring-border">
                  {s.n}
                </span>
                <h3 className="mt-2 font-display text-xl font-semibold">
                  {s.title}
                </h3>
                <p className="text-sm text-muted-foreground">{s.body}</p>
              </article>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}
