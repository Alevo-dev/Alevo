"use client";

import { useState } from "react";
import { ChartTooltip, periodDelta } from "./chart-tooltip";
import { cx } from "./cx";

export type MiniBarsTone = "brand" | "violet" | "success" | "warning" | "danger";

const BAR: Record<MiniBarsTone, string> = {
  brand: "bg-brand",
  violet: "bg-violet",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
};

const SWATCH: Record<MiniBarsTone, string> = {
  brand: "var(--color-brand)",
  violet: "var(--color-violet)",
  success: "var(--color-success)",
  warning: "var(--color-warning)",
  danger: "var(--color-danger)",
};

/** "today", "yesterday", "3 days ago" / "this week", "last week", "3 weeks ago". */
export function relativePeriod(ago: number, period: "day" | "week"): string {
  if (ago === 0) return period === "day" ? "today" : "this week";
  if (ago === 1) return period === "day" ? "yesterday" : "last week";
  return `${ago} ${period}s ago`;
}

/**
 * The stat tile's row of mini bars, oldest first, scaled to the largest. Zero
 * periods show a 2px stub so the row keeps its rhythm. Each bar is a hit target
 * (hover / focus) that shows the period's value in a `ChartTooltip`; the number
 * above the row stays the accessible total.
 */
export function MiniBars({
  series,
  labels,
  unit = "",
  period = "day",
  tone = "brand",
}: {
  series: number[];
  /** One per bar, e.g. "Oct 24"; falls back to "3 days ago". */
  labels?: string[];
  /** Noun for the tooltip, e.g. "leads". */
  unit?: string;
  period?: "day" | "week";
  tone?: MiniBarsTone;
}) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(1, ...series);
  const n = series.length;
  const label = (i: number) => labels?.[i] ?? relativePeriod(n - 1 - i, period);
  const current = active == null ? null : series[active];

  return (
    <div className="relative mt-3.5">
      <div className="flex h-[30px] items-end gap-1" role="group" aria-label={unit ? `${unit} per ${period}` : `Per ${period}`}>
        {series.map((v, i) => (
          <button
            key={i}
            type="button"
            tabIndex={-1}
            aria-label={`${label(i)}: ${v}${unit ? ` ${unit}` : ""}`}
            onPointerEnter={() => setActive(i)}
            onPointerLeave={() => setActive(null)}
            onFocus={() => setActive(i)}
            onBlur={() => setActive(null)}
            // The hit target is the whole column; the painted bar sits at its foot.
            className="group flex h-full flex-1 cursor-default items-end outline-none"
          >
            <span
              className={cx(
                "animate-grow-y w-full rounded-t-[3px] rounded-b-[1px] transition-opacity",
                v > 0 ? BAR[tone] : "bg-raised",
                active != null && active !== i && "opacity-50",
              )}
              style={{
                height: v > 0 ? `${Math.max(8, Math.round((v / max) * 100))}%` : "2px",
                animationDelay: `${100 + i * 80}ms`,
              }}
            />
          </button>
        ))}
      </div>
      {current != null && active != null && (
        <ChartTooltip
          x={(active + 0.5) / n}
          y={current > 0 ? 1 - Math.max(8, Math.round((current / max) * 100)) / 100 : 1}
          value={current}
          label={unit ? `${unit} · ${label(active)}` : label(active)}
          detail={periodDelta(current, series[active - 1], active > 0 ? label(active - 1) : undefined)}
          swatch={SWATCH[tone]}
        />
      )}
    </div>
  );
}
