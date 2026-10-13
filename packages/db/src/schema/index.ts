export * from "./identity";
export * from "./billing";
export * from "./invitations";
export * from "./secrets";
export * from "./audit";
export * from "./files";

import * as identity from "./identity";
import * as billing from "./billing";
import * as invitations from "./invitations";
import * as secrets from "./secrets";
import * as audit from "./audit";
import * as files from "./files";

/** Aggregate passed to drizzle() so `tx.query.*` is available for every table. */
export const schema = {
  ...identity,
  ...billing,
  ...invitations,
  ...secrets,
  ...audit,
  ...files,
};
