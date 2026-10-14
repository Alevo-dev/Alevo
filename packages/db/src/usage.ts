import { sql } from "drizzle-orm";
import { usageCounters, type UsageMetric } from "./schema/billing";
import { withService } from "./with-tenant";

/** Current calendar-month period [start, end) as YYYY-MM-DD date strings (UTC). */
function currentPeriod(now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { periodStart: iso(start), periodEnd: iso(end) };
}

/**
 * Increment a usage counter for the org's current billing period (plan.md rule
 * 11: usage is metered before it is spent). Idempotent on the unique
 * (org_id, metric, period_start). Service path.
 */
export async function recordUsage(orgId: string, metric: UsageMetric, delta = 1): Promise<void> {
  const { periodStart, periodEnd } = currentPeriod();
  await withService((tx) =>
    tx
      .insert(usageCounters)
      .values({ orgId, metric, periodStart, periodEnd, used: delta })
      .onConflictDoUpdate({
        target: [usageCounters.orgId, usageCounters.metric, usageCounters.periodStart],
        set: { used: sql`${usageCounters.used} + ${delta}`, updatedAt: new Date() },
      }),
  );
}
