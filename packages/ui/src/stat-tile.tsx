import { Card } from "./card";
import { CountUp } from "./count-up";
import { cx } from "./cx";
import { MiniBars } from "./mini-bars";

export type StatTone = "brand" | "violet" | "success" | "warning" | "danger";

/** The KPI tile (boards `.kpi`): label, value in mono with tabular figures, bars bottom-right.
 *  A numeric `value` counts up on load; pass a string to show it as-is.
 *  `series` adds a row of mini bars under the number (one per period, scaled
 *  to the largest; hover / focus a bar for its value — `seriesLabels` names the
 *  periods, `unit` the noun), `delta` a one-line reading in success ink, and
 *  `featured` lifts the lead tile with a brand gradient and a two-tone top rule. */
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
  featured = false,
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
    <Card boxed
      as="div"
      padding="none"
      className={cx(
        "relative px-3.5 py-3",
        featured && "border-brand bg-[linear-gradient(160deg,var(--color-brand-soft)_0%,var(--color-surface)_70%)]",
      )}
    >
      {featured && (
        <span
          aria-hidden
          className="absolute inset-x-0 top-0 h-[3px] rounded-t-sm bg-[linear-gradient(100deg,var(--color-brand-sky),var(--color-violet-light))]"
        />
      )}
      <div>
        <div className="text-label font-[550] text-ink-muted">{label}</div>
        <div className="tabular mt-0.5 font-mono text-[28px] font-medium leading-[34px] tracking-[-0.02em] text-ink">
          {typeof value === "number" ? <CountUp value={value} /> : value}
        </div>
        {delta && <div className="mt-0.5 text-[12.5px] font-medium text-success">{delta}</div>}
        {hint && <div className="mt-0.5 text-[12.5px] text-ink-muted">{hint}</div>}
      </div>
      {series && <MiniBars series={series} labels={seriesLabels} unit={unit} period={period} tone={tone} />}
    </Card>
  );
}
