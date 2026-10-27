import { cache } from "react";
import { and, eq, sql } from "drizzle-orm";
import { currentPeriod, orgSubscriptions, plans, usageCounters, usageMetric, type UsageRow } from "@alevo/db";
import { withOrg } from "@alevo/auth";

/**
 * The active org's usage against its plan, for the shell banner and the usage
 * meter. RLS path, scoped explicitly to the current org (platform admins bypass
 * RLS). Cached per request so the layout and a page can both read it.
 */
export const getCurrentUsage = cache(async (): Promise<UsageRow[]> => {
  const { periodStart } = currentPeriod();
  return withOrg(async (tx) => {
    const [sub] = await tx
      .select({ plan: plans })
      .from(orgSubscriptions)
      .innerJoin(plans, eq(plans.id, orgSubscriptions.planId))
      .where(sql`${orgSubscriptions.orgId} = (select app.current_org_id())`)
      .limit(1);
    const counters = await tx
      .select({ metric: usageCounters.metric, used: usageCounters.used })
      .from(usageCounters)
      .where(and(sql`${usageCounters.orgId} = (select app.current_org_id())`, eq(usageCounters.periodStart, periodStart)));
    const used = new Map(counters.map((c) => [c.metric, c.used]));
    const p = sub?.plan;
    const allowance: Record<(typeof usageMetric.enumValues)[number], number> = {
      inbound_conversations: p?.inboundConversations ?? 0,
      voice_minutes: p?.voiceMinutes ?? 0,
      outbound_dials: p?.outboundDials ?? 0,
      sourced_leads: p?.sourcedLeads ?? 0,
      prospecting_emails: p?.prospectingEmails ?? 0,
    };
    return usageMetric.enumValues.map((metric) => ({ metric, used: used.get(metric) ?? 0, allowance: allowance[metric] }));
  });
});
