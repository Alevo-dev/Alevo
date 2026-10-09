export * from "./identity";
export * from "./billing";
export * from "./invitations";

import * as identity from "./identity";
import * as billing from "./billing";
import * as invitations from "./invitations";

/** Aggregate passed to drizzle() so `tx.query.*` is available for every table. */
export const schema = { ...identity, ...billing, ...invitations };
