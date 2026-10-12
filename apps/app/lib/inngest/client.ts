import { Inngest } from "inngest";

/**
 * Inngest client. In dev it talks to the local Inngest dev server
 * (`npx inngest-cli dev`); in prod the Vercel integration sets INNGEST_EVENT_KEY
 * and INNGEST_SIGNING_KEY.
 *
 * Event payloads carry `orgId` (our uuid) so every function can apply a
 * per-tenant concurrency key (plan.md rule 10).
 */
export const inngest = new Inngest({
  id: "alevo",
  // v4 defaults to cloud mode and no longer infers dev from NODE_ENV. In dev
  // this points the SDK at the local dev server (:8288); in prod it's cloud mode
  // using the signing key the Vercel integration sets.
  isDev: process.env.NODE_ENV !== "production",
});

/** Payload for the baseline provisioning event. */
export type OrgProvisionedData = { orgId: string };
