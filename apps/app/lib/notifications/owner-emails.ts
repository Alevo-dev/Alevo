import "server-only";

/** Lives in `@alevo/db` (shared with the admin console's readiness checks); re-exported so callers stay put. */
export { ownerEmails } from "@alevo/db";
