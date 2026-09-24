import { Eyebrow } from "@/components/marketing/section-heading";
import { FadeIn } from "@/components/motion/motion-primitives";

export function PageHeader({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  subtitle?: string;
}) {
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="brand-aura absolute -top-32 left-1/2 h-[50vh] w-[70vw] -translate-x-1/2 opacity-60"
      />
      <div className="container-page relative flex flex-col items-center gap-5 pt-20 pb-10 text-center lg:pt-28">
        {eyebrow ? (
          <FadeIn>
            <Eyebrow>{eyebrow}</Eyebrow>
          </FadeIn>
        ) : null}
        <FadeIn delay={0.05}>
          <h1
            className="max-w-[18ch] font-display font-semibold tracking-tight text-balance"
            style={{ fontSize: "var(--text-h1)", lineHeight: 1.05 }}
          >
            {title}
          </h1>
        </FadeIn>
        {subtitle ? (
          <FadeIn delay={0.1}>
            <p
              className="max-w-2xl text-muted-foreground"
              style={{ fontSize: "var(--text-lead)", lineHeight: 1.55 }}
            >
              {subtitle}
            </p>
          </FadeIn>
        ) : null}
      </div>
    </section>
  );
}
