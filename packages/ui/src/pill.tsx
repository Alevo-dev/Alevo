import { cx } from "./cx";
import type { Tone } from "./tone";

const DOT: Record<Tone, string> = {
  brand: "bg-brand",
  violet: "bg-violet",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  muted: "bg-control",
};

const RING: Record<Tone, string> = {
  brand: "border-brand",
  violet: "border-violet",
  success: "border-success",
  warning: "border-warning",
  danger: "border-danger",
  muted: "border-hairline",
};

/** An 8px state dot. Always paired with a label so state never rests on colour. */
export function StatusDot({ tone, live = false }: { tone: Tone; live?: boolean }) {
  return (
    <span className="relative inline-flex size-2 shrink-0" aria-hidden="true">
      <span className={cx("absolute inset-0 rounded-full", DOT[tone])} />
      {live && (
        <span
          className={cx(
            "absolute -inset-1 animate-ping rounded-full border-2 opacity-70 motion-reduce:hidden",
            RING[tone],
          )}
        />
      )}
    </span>
  );
}

/** Outlined status pill (boards: ok / warn / bad / blue / vio / off): tone text,
 *  a 1px tone border and an 8% tint. Brand / violet text use the *-ink tokens so
 *  it stays legible in both themes. */
const TINT: Record<Tone, string> = {
  brand: "border-brand/60 bg-brand/10 text-brand-ink",
  violet: "border-violet/60 bg-violet/10 text-violet-ink",
  success: "border-success/55 bg-success/10 text-success",
  warning: "border-warning/55 bg-warning/10 text-warning",
  danger: "border-danger/55 bg-danger/10 text-danger",
  muted: "border-control bg-transparent text-ink-muted",
};

/** Status pill: 20px, tinted with a coloured border. */
export function Pill({
  tone,
  children,
  className,
}: {
  tone: Tone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "inline-flex h-5 items-center gap-1.5 whitespace-nowrap rounded-full border px-2 text-[12.5px] font-[550] leading-none",
        TINT[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
