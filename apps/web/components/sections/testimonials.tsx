import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SectionHeading } from "@/components/marketing/section-heading";
import { Stagger, StaggerItem } from "@/components/motion/motion-primitives";
import { testimonials } from "@/content/copy";

export function Testimonials() {
  return (
    <section className="section-y bg-muted/30">
      <div className="container-page flex flex-col gap-14">
        <SectionHeading
          eyebrow={testimonials.eyebrow}
          title={testimonials.title}
        />
        <Stagger className="grid gap-5 lg:grid-cols-3">
          {testimonials.items.map((t) => (
            <StaggerItem key={t.name}>
              <figure className="flex h-full flex-col justify-between gap-6 rounded-3xl border border-border bg-card p-7 shadow-(--shadow-card)">
                <blockquote className="font-display text-lg leading-snug text-balance">
                  “{t.quote}”
                </blockquote>
                <figcaption className="flex items-center gap-3">
                  <Avatar className="size-11">
                    <AvatarImage src={t.avatar} alt={t.name} />
                    <AvatarFallback>{t.initials}</AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="text-sm font-semibold">{t.name}</div>
                    <div className="text-sm text-muted-foreground">{t.role}</div>
                  </div>
                </figcaption>
              </figure>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}
