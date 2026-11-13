import { eq, sql } from "drizzle-orm";
import { orgSubscriptions, plans } from "@alevo/db";
import { withOrg } from "@alevo/auth";

export type PlanCard = { name: string; renews: string | null } | null;

/** The active org's plan for Settings (explicitly scoped to the active org). */
export async function loadPlan(): Promise<PlanCard> {
  const [row] = await withOrg((tx) =>
    tx
      .select({ name: plans.name, periodEnd: orgSubscriptions.currentPeriodEnd })
      .from(orgSubscriptions)
      .innerJoin(plans, eq(plans.id, orgSubscriptions.planId))
      .where(sql`${orgSubscriptions.orgId} = (select app.current_org_id())`)
      .limit(1),
  );
  if (!row) return null;
  const renews = row.periodEnd
    ? new Date(row.periodEnd).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
    : null;
  return { name: row.name, renews };
}
