import type { ReactNode } from "react";
import { TipPortal } from "./tip-portal";

/**
 * The one tooltip every chart shows on hover / focus (dataviz: value leads,
 * label follows; it enhances, never gates — the sr-only table or the direct
 * labels carry the same numbers). Render it inside a `relative` box that wraps
 * the chart and give it the mark's position as fractions of that box, so it
 * scales with a responsive SVG. It is drawn on the page body (`TipPortal`), so no card can crop it; it sits just above the mark, flipping below when there is no room, and its anchor flips near the edges.
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
    <TipPortal x={x} y={y} anchor={anchor} className={className}>
      <div className="flex items-center gap-2">
        {swatch && <span aria-hidden className="inline-block h-0.5 w-3 rounded-full" style={{ background: swatch }} />}
        <span className="tabular font-mono text-sm font-semibold text-ink">{value}</span>
        <span className="text-ink-muted">{label}</span>
      </div>
      {detail && <div className="mt-1 text-ink-muted">{detail}</div>}
    </TipPortal>
  );
}

/** "Up 2 from Oct 23" / "Down 1 from Oct 23" / "Same as Oct 23" — the delta line for a period series. */
export function periodDelta(n: number, prev: number | undefined, prevLabel: string | undefined): string | undefined {
  if (prev == null || !prevLabel) return undefined;
  const d = n - prev;
  if (d === 0) return `Same as ${prevLabel}`;
  return `${d > 0 ? "Up" : "Down"} ${Math.abs(d)} from ${prevLabel}`;
}
