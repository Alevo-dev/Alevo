import {
  Sparkles,
  Users,
  CalendarCheck,
  Brain,
  LineChart,
  HeartHandshake,
  type LucideIcon,
} from "lucide-react";
import { SectionHeading } from "@/components/marketing/section-heading";
import { Stagger, StaggerItem } from "@/components/motion/motion-primitives";
import { features } from "@/content/copy";

const ICONS: Record<string, LucideIcon> = {
  sparkles: Sparkles,
  users: Users,
  calendar: CalendarCheck,
  brain: Brain,
  "line-chart": LineChart,
  "heart-handshake": HeartHandshake,
};

export function Features() {
  return (
    <section id="features" className="section-y bg-muted/30">
      <div className="container-page flex flex-col gap-14">
        <SectionHeading
          eyebrow={features.eyebrow}
          title={features.title}
          subtitle={features.subtitle}
        />

        <Stagger className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.items.map((f) => {
            const Icon = ICONS[f.icon] ?? Sparkles;
            return (
              <StaggerItem key={f.title}>
                <article className="group h-full rounded-3xl border border-border bg-card p-6 transition-all duration-(--dur) hover:-translate-y-1 hover:shadow-(--shadow-card)">
                  <span className="grid size-11 place-items-center rounded-2xl bg-background text-brand-violet ring-1 ring-border transition-colors group-hover:[background-image:var(--brand-gradient-soft)]">
                    <Icon className="size-5" />
                  </span>
                  <h3 className="mt-5 font-display text-lg font-semibold">
                    {f.title}
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
                </article>
              </StaggerItem>
            );
          })}
        </Stagger>
      </div>
    </section>
  );
}
