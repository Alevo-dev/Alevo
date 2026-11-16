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

/** Status pill. Blue / green / yellow / red are the SAME pastel fill with deep text in light and dark
 *  (a light chip reads on both grounds, so no per-theme shades). Violet and muted stay outlined tints;
 *  violet text uses the *-ink token so it is legible in both themes. */
const TINT: Record<Tone, string> = {
  brand: "border-transparent bg-[#d9edfd] text-[#0f5c99]",
  violet: "border-violet/60 bg-violet/10 text-violet-ink",
  success: "border-transparent bg-[#d3f3e7] text-[#0a6a4e]",
  warning: "border-transparent bg-[#fdecc2] text-[#7a4a00]",
  danger: "border-transparent bg-[#fddcda] text-[#a3201a]",
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
