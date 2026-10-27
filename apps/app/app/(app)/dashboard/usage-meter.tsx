import type { UsageRow } from "@alevo/db";
import { Card, CardHeader } from "@/components/ui/card";
import { cx } from "@/lib/cx";
import { METRIC_LABEL, PRICING_URL, pct, usageLevel } from "@/lib/usage/levels";

const FILL = {
  ok: "bg-brand",
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
export function UsageMeter({ rows }: { rows: UsageRow[] }) {
  const metered = rows.filter((r) => r.allowance > 0);
  return (
    <Card>
      <CardHeader
        title="Plan usage"
        hint="This billing month"
        aside={
          <a href={PRICING_URL} target="_blank" rel="noopener noreferrer">
            Compare plans
          </a>
        }
      />
      {metered.length === 0 ? (
        <p className="mt-6 text-sm text-ink-muted">No plan allowances yet.</p>
      ) : (
        <ul className="mt-5 space-y-4">
          {metered.map((r, i) => {
            const level = usageLevel(r.used, r.allowance);
            const share = pct(r.used, r.allowance);
            return (
              <li key={r.metric}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-medium text-ink">{METRIC_LABEL[r.metric]}</span>
                  <span className="tabular font-mono text-label text-ink-muted">
                    {r.used} of {r.allowance}
                    {NOTE[level] ? ` · ${NOTE[level]}` : ""}
                  </span>
                </div>
                <div
                  role="progressbar"
                  aria-label={METRIC_LABEL[r.metric]}
                  aria-valuemin={0}
                  aria-valuemax={r.allowance}
                  aria-valuenow={Math.min(r.used, r.allowance)}
                  className="mt-1.5 h-2 overflow-hidden rounded-full bg-raised"
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
      <p className="mt-4 text-label text-ink-muted">Alerts at 80 percent. The agent pauses at the limit; nothing is billed automatically.</p>
    </Card>
  );
}
