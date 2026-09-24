import { cn } from "cn";
import { FadeIn } from "@/components/motion/motion-primitives";

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs font-medium tracking-wide text-muted-foreground uppercase backdrop-blur">
      <span className="size-1.5 rounded-full [background-image:var(--brand-gradient)]" />
      {children}
    </span>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  align = "center",
  className,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  subtitle?: string;
  align?: "center" | "left";
  className?: string;
}) {
  return (
    <FadeIn
      className={cn(
        "flex flex-col gap-4",
        align === "center" ? "items-center text-center" : "items-start",
        className,
      )}
    >
      {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
      <h2
        className="text-balance font-display font-semibold"
        style={{ fontSize: "var(--text-h2)", lineHeight: 1.08 }}
      >
        {title}
      </h2>
      {subtitle ? (
        <p
          className={cn(
            "text-muted-foreground",
            align === "center" ? "max-w-2xl" : "max-w-xl",
          )}
          style={{ fontSize: "var(--text-lead)", lineHeight: 1.5 }}
        >
          {subtitle}
        </p>
      ) : null}
    </FadeIn>
  );
}
