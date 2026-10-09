export * from "./identity";
export * from "./billing";

import * as identity from "./identity";
import * as billing from "./billing";

/** Aggregate passed to drizzle() so `tx.query.*` is available for every table. */
export const schema = { ...identity, ...billing };
