import { CountUp } from "./count-up";
import { MiniBars } from "./mini-bars";

export type StatTone = "brand" | "violet" | "success" | "warning" | "danger";

/** The KPI tile (boards `.kpi`), flat: a divider on its left edge, no box; put it in a `border-y` grid. Label, value in mono with tabular figures, bars bottom-right.
 *  A numeric `value` counts up on load; pass a string to show it as-is.
 *  `series` adds a row of mini bars under the number (one per period, scaled
 *  to the largest; hover / focus a bar for its value — `seriesLabels` names the
 *  periods, `unit` the noun), `delta` a one-line reading in success ink, and
 *  `featured` is kept for callers and no longer changes the look (no boxes). */
export function StatTile({
  label,
  value,
  hint,
  delta,
  series,
  seriesLabels,
  unit,
  period,
  tone = "brand",
  featured: _featured = false,
}: {
  label: string;
  value: string | number;
  hint?: string;
  delta?: string;
  series?: number[];
  /** One label per `series` entry (e.g. "Oct 24"); without them bars say "3 days ago". */
  seriesLabels?: string[];
  /** Noun for the bar tooltip, e.g. "leads". */
  unit?: string;
  period?: "hour" | "day" | "week";
  tone?: StatTone;
  featured?: boolean;
}) {
  return (
    <div className="relative min-h-[100px] border-l border-hairline px-4 py-3 first:border-l-0 first:pl-0 max-lg:nth-[odd]:border-l-0 max-lg:nth-[odd]:pl-0">
      <div>
        <div className="text-label font-[550] text-ink-muted">{label}</div>
        <div className="tabular mt-0.5 font-mono text-[28px] font-medium leading-[34px] tracking-[-0.02em] text-ink">
          {typeof value === "number" ? <CountUp value={value} /> : value}
        </div>
        {delta && <div className="mt-0.5 text-[12.5px] font-medium text-success">{delta}</div>}
        {hint && <div className="mt-0.5 text-[12.5px] text-ink-muted">{hint}</div>}
      </div>
      {series && <MiniBars series={series} labels={seriesLabels} unit={unit} period={period} tone={tone} />}
    </div>
  );
}
