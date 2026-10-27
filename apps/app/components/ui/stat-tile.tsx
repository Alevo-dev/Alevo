import { Card } from "./card";
import { CountUp } from "./count-up";
import { cx } from "@/lib/cx";

export type StatTone = "brand" | "violet" | "success" | "warning";

const BAR: Record<StatTone, string> = {
  brand: "bg-brand",
  violet: "bg-violet",
  success: "bg-success",
  warning: "bg-warning",
};

/** The big-number tile: label in muted ink, value in mono with tabular figures.
 *  A numeric `value` counts up on load; pass a string to show it as-is.
 *  `series` adds a row of mini bars under the number (one per period, scaled
 *  to the largest), `delta` a one-line reading in success ink, and `featured`
 *  lifts the lead tile with a brand gradient and a two-tone top rule. */
export function StatTile({
  label,
  value,
  hint,
  delta,
  series,
  tone = "brand",
  featured = false,
}: {
  label: string;
  value: string | number;
  hint?: string;
  delta?: string;
  series?: number[];
  tone?: StatTone;
  featured?: boolean;
}) {
  return (
    <Card
      as="div"
      padding="sm"
      className={cx(
        "rounded-md",
        series &&
          "relative flex min-h-[132px] flex-col justify-between overflow-hidden",
        featured &&
          "border-brand bg-[linear-gradient(160deg,var(--color-brand-soft)_0%,var(--color-surface)_70%)]",
      )}
    >
      {featured && (
        <span
          aria-hidden
          className="absolute inset-x-0 top-0 h-[3px] bg-[linear-gradient(100deg,var(--color-brand-sky),var(--color-violet-light))]"
        />
      )}
      <div>
        <div className="text-label text-ink-muted">{label}</div>
        <div className="tabular mt-2 font-mono text-metric font-medium tracking-tight text-ink">
          {typeof value === "number" ? <CountUp value={value} /> : value}
        </div>
        {delta && (
          <div className="mt-1.5 text-xs font-medium text-success">{delta}</div>
        )}
        {hint && <div className="mt-1 text-label text-ink-muted">{hint}</div>}
      </div>
      {series && <MiniBars series={series} tone={tone} />}
    </Card>
  );
}

/** Seven (or so) bars, oldest first, scaled to the largest. Zero days show a
 *  2px stub so the row keeps its rhythm. Decorative: the number above is the
 *  accessible value. */
function MiniBars({ series, tone }: { series: number[]; tone: StatTone }) {
  const max = Math.max(1, ...series);
  return (
    <div aria-hidden className="mt-3.5 flex h-[30px] items-end gap-1">
      {series.map((n, i) => (
        <span
          key={i}
          className={cx(
            "animate-grow-y flex-1 rounded-t-[3px] rounded-b-[1px]",
            n > 0 ? BAR[tone] : "bg-raised",
          )}
          style={{
            height:
              n > 0 ? `${Math.max(8, Math.round((n / max) * 100))}%` : "2px",
            animationDelay: `${100 + i * 80}ms`,
          }}
        />
      ))}
    </div>
  );
}
