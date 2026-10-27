import { and, eq, sql } from "drizzle-orm";
import { orgSubscriptions, plans, usageCounters, usageMetric, type UsageMetric } from "./schema/billing";
import { withService } from "./with-tenant";

/** Current calendar-month period [start, end) as YYYY-MM-DD date strings (UTC). */
export function currentPeriod(now = new Date()) {
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
export async function recordUsage(orgId: string, metric: UsageMetric, delta = 1): Promise<number> {
  const { periodStart, periodEnd } = currentPeriod();
  const [row] = await withService((tx) =>
    tx
      .insert(usageCounters)
      .values({ orgId, metric, periodStart, periodEnd, used: delta })
      .onConflictDoUpdate({
        target: [usageCounters.orgId, usageCounters.metric, usageCounters.periodStart],
        set: { used: sql`${usageCounters.used} + ${delta}`, updatedAt: new Date() },
      })
      .returning({ used: usageCounters.used }),
  );
  // The new total, so callers can tell whether this increment crossed a threshold.
  return row?.used ?? delta;
}

export type UsageRow = { metric: UsageMetric; used: number; allowance: number };

/** The plan's monthly allowance per metric (0 = not included / not metered). */
function allowances(plan: typeof plans.$inferSelect | null): Record<UsageMetric, number> {
  return {
    inbound_conversations: plan?.inboundConversations ?? 0,
    voice_minutes: plan?.voiceMinutes ?? 0,
    outbound_dials: plan?.outboundDials ?? 0,
    sourced_leads: plan?.sourcedLeads ?? 0,
    prospecting_emails: plan?.prospectingEmails ?? 0,
  };
}

/**
 * Current-period usage against the org's plan, one row per metric. Service path,
 * scoped by orgId in code — used by the limit gates (Inngest, webhooks) and by
 * the shell banner through a per-request wrapper.
 */
export async function getUsage(orgId: string): Promise<UsageRow[]> {
  const { periodStart } = currentPeriod();
  return withService(async (tx) => {
    const [sub] = await tx
      .select({ plan: plans })
      .from(orgSubscriptions)
      .innerJoin(plans, eq(plans.id, orgSubscriptions.planId))
      .where(eq(orgSubscriptions.orgId, orgId))
      .limit(1);
    const counters = await tx
      .select({ metric: usageCounters.metric, used: usageCounters.used })
      .from(usageCounters)
      .where(and(eq(usageCounters.orgId, orgId), eq(usageCounters.periodStart, periodStart)));
    const used = new Map(counters.map((c) => [c.metric, c.used]));
    const limit = allowances(sub?.plan ?? null);
    return usageMetric.enumValues.map((metric) => ({ metric, used: used.get(metric) ?? 0, allowance: limit[metric] }));
  });
}
