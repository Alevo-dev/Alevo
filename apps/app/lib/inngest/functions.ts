import { eq } from "drizzle-orm";
import { orgSubscriptions, plans, withService } from "@alevo/db";
import { inngest, type OrgProvisionedData } from "./client";

/**
 * Runs once per newly-provisioned org (emitted by the Clerk org.created webhook
 * — this REACTS to an org being created; it does not create one). Does the
 * first real onboarding step: give the org a default Starter subscription.
 * Later setup (default settings, etc.) hangs off this event as more steps.
 *
 * Per-tenant concurrency (plan.md rule 10): keyed on `event.data.orgId` so one
 * tenant can never starve others.
 */
export const orgProvisioned = inngest.createFunction(
  {
    id: "org-provisioned",
    concurrency: { key: "event.data.orgId", limit: 1 },
    triggers: [{ event: "org/provisioned" }],
  },
  async ({ event, step }) => {
    const { orgId } = event.data as OrgProvisionedData;

    // A DB write that should retry independently → its own step (rule 10).
    const result = await step.run("seed-default-subscription", () =>
      withService(async (tx) => {
        const [starter] = await tx
          .select({ id: plans.id })
          .from(plans)
          .where(eq(plans.key, "starter"))
          .limit(1);
        if (!starter) throw new Error("Starter plan not seeded (run migration 0002)");

        await tx
          .insert(orgSubscriptions)
          .values({ orgId, planId: starter.id, status: "trialing" })
          .onConflictDoNothing(); // org_id is unique → idempotent on replay

        return { orgId, planId: starter.id };
      }),
    );

    return { ok: true, ...result };
  },
);

/** Every Inngest function must be registered in the serve route. */
export const functions = [orgProvisioned];
