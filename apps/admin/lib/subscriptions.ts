import { orgSubscriptions, withService } from "@alevo/db";

/**
 * Put an org on a plan. New orgs start `trialing` (the same as `org/provisioned`
 * seeds, which uses onConflictDoNothing, so whichever write lands first the plan
 * chosen here wins); an existing subscription only changes plan.
 */
export async function setOrgPlan(orgId: string, planId: string): Promise<void> {
  await withService((tx) =>
    tx
      .insert(orgSubscriptions)
      .values({ orgId, planId, status: "trialing" })
      .onConflictDoUpdate({ target: orgSubscriptions.orgId, set: { planId, updatedAt: new Date() } }),
  );
}
