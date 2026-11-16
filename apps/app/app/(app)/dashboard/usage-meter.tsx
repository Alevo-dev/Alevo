import type { UsageRow } from "@alevo/db";
import { Card, CardHeader } from "@/components/ui/card";
import { cx } from "@/lib/cx";
import { METRIC_LABEL, PRICING_URL, pct, usageLevel } from "@/lib/usage/levels";

const MONTH = new Intl.DateTimeFormat("en-US", { month: "long", timeZone: "UTC" });

const FILL = {
  ok: "bg-[linear-gradient(100deg,var(--color-brand-sky),var(--color-violet-light))]",
  warning: "bg-warning",
  exceeded: "bg-danger",
} as const;

const NOTE = {
  ok: null,
  warning: "Near the limit",
  exceeded: "Paused at the limit",
} as const;

/**
 * Plan usage this billing month: one bar per metered allowance (metrics the plan
 * doesn't include are hidden). Amber from 80%, red at 100%, each with its state
 * written out. Always the current month, whatever the page's time window.
 */
export function UsageMeter({ rows, plan, month }: { rows: UsageRow[]; plan: string | null; month: string }) {
  const metered = rows.filter((r) => r.allowance > 0);
  return (
    <Card boxed>
      <CardHeader
        title="Plan usage"
        hint={`${MONTH.format(new Date(`${month}T00:00:00Z`))}${plan ? `, ${plan} plan` : ""}`}
        aside={
          <a href={PRICING_URL} target="_blank" rel="noopener noreferrer">
            Compare plans
          </a>
        }
      />
      {metered.length === 0 ? (
        <p className="text-sm text-ink-muted">No plan allowances yet.</p>
      ) : (
        <ul className="space-y-3">
          {metered.map((r, i) => {
            const level = usageLevel(r.used, r.allowance);
            const share = pct(r.used, r.allowance);
            return (
              <li key={r.metric}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-medium text-ink">{METRIC_LABEL[r.metric]}</span>
                  <span className="tabular font-mono text-label text-ink-muted">
                    {r.used} / {r.allowance}
                    {NOTE[level] ? ` · ${NOTE[level]}` : ""}
                  </span>
                </div>
                <div
                  role="progressbar"
                  aria-label={METRIC_LABEL[r.metric]}
                  aria-valuemin={0}
                  aria-valuemax={r.allowance}
                  aria-valuenow={Math.min(r.used, r.allowance)}
                  className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-raised"
                >
                  <span
                    className={cx("animate-grow-x block h-full origin-left rounded-full", FILL[level])}
                    style={{ width: `${Math.max(share > 0 ? 2 : 0, share)}%`, animationDelay: `${80 + i * 90}ms` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-3.5 text-[13px] text-ink-muted">Bars turn amber at 80% and red at 100%, when the agent pauses.</p>
    </Card>
  );
}
