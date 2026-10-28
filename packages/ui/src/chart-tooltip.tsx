import type { ReactNode } from "react";
import { cx } from "./cx";

/**
 * The one tooltip every chart shows on hover / focus (dataviz: value leads,
 * label follows; it enhances, never gates — the sr-only table or the direct
 * labels carry the same numbers). Render it inside a `relative` box that wraps
 * the chart and give it the mark's position as fractions of that box, so it
 * scales with a responsive SVG. It sits just above the mark and flips its
 * anchor near the edges so it never wraps or leaves the card.
 */
export function ChartTooltip({
  x,
  y,
  value,
  label,
  detail,
  swatch,
  className,
}: {
  /** Horizontal position of the mark, 0–1 across the box. */
  x: number;
  /** Vertical position of the mark, 0–1 down the box (the tip sits 8px above it). */
  y: number;
  /** The number, bold. */
  value: ReactNode;
  /** What it is and when, e.g. "leads · Oct 24". */
  label: ReactNode;
  /** A second, quieter line, e.g. "Up 2 from Oct 23". */
  detail?: ReactNode;
  /** A short stroke in the series colour (CSS colour), as in a legend. */
  swatch?: string;
  className?: string;
}) {
  const anchor = x < 0.18 ? "start" : x > 0.82 ? "end" : "center";
  return (
    <div
      role="status"
      className={cx(
        "animate-rise pointer-events-none absolute z-10 rounded-md border border-hairline bg-raised px-3 py-2 text-xs leading-tight whitespace-nowrap shadow-float",
        anchor === "start" && "-translate-y-[calc(100%+10px)]",
        anchor === "center" && "-translate-x-1/2 -translate-y-[calc(100%+10px)]",
        anchor === "end" && "-translate-x-full -translate-y-[calc(100%+10px)]",
        className,
      )}
      style={{ left: `${x * 100}%`, top: `${y * 100}%` }}
    >
      <div className="flex items-center gap-2">
        {swatch && <span aria-hidden className="inline-block h-0.5 w-3 rounded-full" style={{ background: swatch }} />}
        <span className="tabular font-mono text-sm font-semibold text-ink">{value}</span>
        <span className="text-ink-muted">{label}</span>
      </div>
      {detail && <div className="mt-1 text-ink-muted">{detail}</div>}
    </div>
  );
}

/** "Up 2 from Oct 23" / "Down 1 from Oct 23" / "Same as Oct 23" — the delta line for a period series. */
export function periodDelta(n: number, prev: number | undefined, prevLabel: string | undefined): string | undefined {
  if (prev == null || !prevLabel) return undefined;
  const d = n - prev;
  if (d === 0) return `Same as ${prevLabel}`;
  return `${d > 0 ? "Up" : "Down"} ${Math.abs(d)} from ${prevLabel}`;
}
