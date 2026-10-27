export * from "./identity";
export * from "./billing";
export * from "./invitations";
export * from "./secrets";
export * from "./audit";
export * from "./files";
export * from "./conversations";
export * from "./org-profiles";
export * from "./knowledge";
export * from "./suppressions";
export * from "./meetings";
export * from "./webhook-deliveries";
export * from "./calls";
export * from "./rate-limits";
export * from "./psa";
export * from "./platform-secrets";

import * as identity from "./identity";
import * as billing from "./billing";
import * as invitations from "./invitations";
import * as secrets from "./secrets";
import * as audit from "./audit";
import * as files from "./files";
import * as conversations from "./conversations";
import * as orgProfiles from "./org-profiles";
import * as knowledge from "./knowledge";
import * as suppressions from "./suppressions";
import * as meetings from "./meetings";
import * as webhookDeliveries from "./webhook-deliveries";
import * as calls from "./calls";
import * as rateLimits from "./rate-limits";
import * as psa from "./psa";
import * as platformSecrets from "./platform-secrets";

/** Aggregate passed to drizzle() so `tx.query.*` is available for every table. */
export const schema = {
  ...identity,
  ...billing,
  ...invitations,
  ...secrets,
  ...audit,
  ...files,
  ...conversations,
  ...orgProfiles,
  ...knowledge,
  ...suppressions,
  ...meetings,
  ...webhookDeliveries,
  ...calls,
  ...rateLimits,
  ...psa,
  ...platformSecrets,
};
