import Image from "next/image";
import Link from "next/link";
import { buttonClass } from "./button";
import { cx } from "./cx";

/**
 * The one screen for every "you can't see this" state across Alevo's apps:
 * not found, no access, signed out, something broke. Same bones everywhere —
 * the mark, a short mono status line, a headline in the display face, one
 * honest sentence, then the way out. `standalone` draws its own canvas for
 * routes outside an app shell; inside a shell it sits in the content column.
 * Needs the host app to serve `/alevo-mark.png` and load `@alevo/ui/theme.css`.
 */
export function StatusScreen({
  code,
  kicker,
  title,
  description,
  actions,
  reference,
  standalone = false,
  className,
}: {
  /** HTTP-ish status, read as data: "404", "403", "401", "500". */
  code: string;
  /** Two or three words after the code: "Page not found". */
  kicker: string;
  title: string;
  description: React.ReactNode;
  actions: React.ReactNode;
  /** A digest or id people can quote to support. */
  reference?: string | null;
  standalone?: boolean;
  /** Extra classes on the outer element (e.g. next/font variables for a host with other fonts). */
  className?: string;
}) {
  const body = (
    <div className="relative mx-auto flex w-full max-w-md flex-col items-center text-center">
      <div className="flex size-14 items-center justify-center rounded-lg border border-hairline bg-surface shadow-float">
        <Image src="/alevo-mark.png" alt="" width={32} height={32} className="size-8" priority />
      </div>
      <p className="tabular mt-7 font-mono text-label text-ink-muted">
        {code} · {kicker}
      </p>
      <h1 className="mt-3 font-display text-title font-semibold tracking-tight text-ink">{title}</h1>
      <p className="mt-3 text-[15px] leading-6 text-ink-muted">{description}</p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">{actions}</div>
      {reference && (
        <p className="mt-8 font-mono text-label text-ink-muted">
          Reference <span className="select-all text-ink">{reference}</span>
        </p>
      )}
    </div>
  );

  // The glow echoes the auth art: brand light pooling behind the mark, never a flat fill.
  const glow =
    "pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_30%,color-mix(in_oklab,var(--ds-brand)_18%,transparent),transparent_70%)]";

  if (standalone) {
    return (
      <main className={cx("relative flex min-h-dvh items-center justify-center overflow-hidden bg-canvas px-5 py-12 text-ink", className)}>
        <div aria-hidden="true" className={glow} />
        <div className="animate-rise w-full">{body}</div>
      </main>
    );
  }
  return (
    <section
      aria-labelledby="status-title"
      className={cx("relative flex min-h-[60dvh] items-center justify-center overflow-hidden rounded-lg border border-hairline bg-surface px-6 py-16", className)}
    >
      <div aria-hidden="true" className={glow} />
      <div className="animate-rise w-full">{body}</div>
    </section>
  );
}

/** A link styled as the screen's main action. */
export function StatusAction({
  href,
  children,
  variant = "primary",
}: {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary";
}) {
  return (
    <Link href={href} className={buttonClass(variant, "md", "no-underline")}>
      {children}
    </Link>
  );
}

/** Where every status screen sends people for help. */
export const SUPPORT_EMAIL = "admin@getalevo.com";
