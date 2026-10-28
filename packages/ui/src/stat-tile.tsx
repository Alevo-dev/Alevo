import { Card } from "./card";
import { CountUp } from "./count-up";
import { cx } from "./cx";
import { MiniBars } from "./mini-bars";

export type StatTone = "brand" | "violet" | "success" | "warning" | "danger";

/** The big-number tile: label in muted ink, value in mono with tabular figures.
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
  period?: "day" | "week";
  tone?: StatTone;
  featured?: boolean;
}) {
  return (
    <Card
      as="div"
      padding="sm"
      className={cx(
        "rounded-md",
        series && "relative flex min-h-[132px] flex-col justify-between",
        featured && "border-brand bg-[linear-gradient(160deg,var(--color-brand-soft)_0%,var(--color-surface)_70%)]",
      )}
    >
      {featured && (
        <span
          aria-hidden
          className="absolute inset-x-0 top-0 h-[3px] rounded-t-md bg-[linear-gradient(100deg,var(--color-brand-sky),var(--color-violet-light))]"
        />
      )}
      <div>
        <div className="text-label text-ink-muted">{label}</div>
        <div className="tabular mt-2 font-mono text-metric font-medium tracking-tight text-ink">
          {typeof value === "number" ? <CountUp value={value} /> : value}
        </div>
        {delta && <div className="mt-1.5 text-xs font-medium text-success">{delta}</div>}
        {hint && <div className="mt-1 text-label text-ink-muted">{hint}</div>}
      </div>
      {series && <MiniBars series={series} labels={seriesLabels} unit={unit} period={period} tone={tone} />}
    </Card>
  );
}
