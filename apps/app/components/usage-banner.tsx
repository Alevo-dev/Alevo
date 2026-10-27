import type { UsageRow } from "@alevo/db";
import { Notice } from "@/components/ui/notice";
import { METRIC_LABEL, PRICING_URL, pct, usageLevel } from "@/lib/usage/levels";

/**
 * Shell banner for plan limits: silent below 80%, a warning from 80%, and a
 * danger notice once an allowance is used up and the agent has paused that
 * activity. One line per affected metric; never a toast (errors aren't toasts).
 */
export function UsageBanner({ rows }: { rows: UsageRow[] }) {
  const hot = rows
    .map((r) => ({ ...r, level: usageLevel(r.used, r.allowance) }))
    .filter((r) => r.level !== "ok");
  if (hot.length === 0) return null;
  const exceeded = hot.some((r) => r.level === "exceeded");

  return (
    <Notice tone={exceeded ? "danger" : "warning"} className="mb-4">
      <ul className="space-y-1">
        {hot.map((r) => (
          <li key={r.metric}>
            <span className="font-medium">{METRIC_LABEL[r.metric]}:</span> {r.used} of {r.allowance} used this month ({pct(r.used, r.allowance)}%).{" "}
            {r.level === "exceeded"
              ? "The agent has paused this until next month or an upgrade."
              : "At the limit the agent pauses this activity."}
          </li>
        ))}
      </ul>
      <p className="mt-1">
        Nothing is billed automatically.{" "}
        <a href={PRICING_URL} target="_blank" rel="noopener noreferrer">
          Compare plans
        </a>
        .
      </p>
    </Notice>
  );
}
