import { inngest, type OrgProvisionedData } from "./client";

/**
 * Runs once per newly-provisioned org (sent by the Clerk org.created webhook).
 * The baseline function that proves the durable-workflow rail end to end. Later
 * onboarding setup (seed a trial subscription, default settings, etc.) hangs off
 * this event as additional steps.
 *
 * Demonstrates the per-tenant concurrency convention (plan.md rule 10): keyed on
 * `event.data.orgId` so one tenant can never starve others.
 */
export const orgProvisioned = inngest.createFunction(
  {
    id: "org-provisioned",
    concurrency: { key: "event.data.orgId", limit: 1 },
    triggers: [{ event: "org/provisioned" }],
  },
  async ({ event, step }) => {
    const { orgId } = event.data as OrgProvisionedData;

    // Only make something a step if it calls a vendor or needs independent retry
    // (rule 10). This placeholder step marks the baseline as exercised.
    const result = await step.run("mark-provisioned", async () => ({ orgId }));

    return { ok: true, ...result };
  },
);

/** Every Inngest function must be registered in the serve route. */
export const functions = [orgProvisioned];
