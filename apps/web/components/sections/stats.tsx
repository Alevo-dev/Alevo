import { FadeIn, Stagger, StaggerItem } from "@/components/motion/motion-primitives";
import { stats } from "@/content/copy";

export function Stats() {
  return (
    <section className="section-y">
      <div className="container-page">
        <div className="relative overflow-hidden rounded-[2rem] border border-border bg-card px-6 py-14 shadow-(--shadow-card) sm:px-12">
          <div className="brand-aura absolute inset-x-0 -top-1/2 h-full opacity-60" aria-hidden />
          <FadeIn className="relative">
            <h2 className="text-center font-display text-2xl font-semibold text-balance sm:text-3xl">
              {stats.title}
            </h2>
          </FadeIn>
          <Stagger className="relative mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {stats.items.map((s) => (
              <StaggerItem key={s.label} className="text-center">
                <div className="font-display text-4xl font-semibold text-gradient sm:text-5xl">
                  {s.value}
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{s.label}</p>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </div>
    </section>
  );
}
