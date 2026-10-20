import { cx } from "@/lib/cx";
import type { Tone } from "@/lib/ui/status";

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

/** Solid status fills use the vivid (dark-theme) hues in BOTH themes; the text
 *  follows the theme (white on light, navy on dark). */
const FILL: Record<Tone, string> = {
  brand: "bg-vivid-brand text-on-vivid",
  violet: "bg-vivid-violet text-on-vivid",
  success: "bg-vivid-success text-on-vivid",
  warning: "bg-vivid-warning text-on-vivid",
  danger: "bg-vivid-danger text-on-vivid",
  muted: "border border-hairline bg-raised text-ink-muted",
};

/** Status pill: solid tone background, contrasting text. */
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
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold leading-4",
        FILL[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
