import Link from "next/link";
import { type ReactNode } from "react";
import { cn } from "cn";
import { appLinks } from "@/lib/site";

type CtaHref = keyof typeof appLinks | (string & {});

/** Resolve app-link keys ("signup") to full URLs; pass paths/URLs through. */
export function resolveHref(href: CtaHref): string {
  if (href in appLinks) return appLinks[href as keyof typeof appLinks];
  return href;
}

const base =
  "group inline-flex items-center justify-center gap-2 rounded-full font-medium transition-all duration-(--dur-fast) outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 cursor-pointer";

const sizes = {
  md: "h-10 px-5 text-sm",
  lg: "h-12 px-7 text-base",
} as const;

const variants = {
  // Brand gradient with a soft glow lift
  primary:
    "text-white shadow-[0_8px_30px_-8px_color-mix(in_oklab,var(--brand-violet)_60%,transparent)] hover:shadow-[0_12px_40px_-8px_color-mix(in_oklab,var(--brand-violet)_75%,transparent)] hover:-translate-y-0.5 [background-image:var(--brand-gradient)] bg-[length:150%_150%] hover:bg-[position:100%_50%]",
  secondary:
    "border border-border bg-card/60 text-foreground backdrop-blur hover:bg-muted hover:-translate-y-0.5",
  ghost: "text-foreground/80 hover:text-foreground hover:bg-muted",
} as const;

export function CtaButton({
  href,
  children,
  variant = "primary",
  size = "lg",
  className,
}: {
  href: CtaHref;
  children: ReactNode;
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  className?: string;
}) {
  const resolved = resolveHref(href);
  const classes = cn(base, sizes[size], variants[variant], className);
  const isExternal = /^https?:\/\//.test(resolved);

  if (isExternal) {
    return (
      <a href={resolved} className={classes}>
        {children}
      </a>
    );
  }
  return (
    <Link href={resolved} className={classes}>
      {children}
    </Link>
  );
}
