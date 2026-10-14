export * from "./identity";
export * from "./billing";
export * from "./invitations";
export * from "./secrets";
export * from "./audit";
export * from "./files";
export * from "./conversations";
export * from "./org-profiles";

import * as identity from "./identity";
import * as billing from "./billing";
import * as invitations from "./invitations";
import * as secrets from "./secrets";
import * as audit from "./audit";
import * as files from "./files";
import * as conversations from "./conversations";
import * as orgProfiles from "./org-profiles";

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
};
