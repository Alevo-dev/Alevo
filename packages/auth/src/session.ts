import "server-only";
import { auth } from "@clerk/nextjs/server";
import { withTenant, type Tx } from "@alevo/db";
import { UnauthorizedError } from "./errors";

/**
 * Run `fn` scoped to the caller's active organization, with RLS enforced.
 * Reads the verified Clerk session, converts it to tenant claims, and hands off
 * to the db seam. This is the ergonomic entry point every tenant query uses;
 * nothing outside `@alevo/auth` should import Clerk (plan.md rule 3).
 */
export async function withOrg<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  const { userId, orgId, orgRole } = await auth();
  if (!userId) throw new UnauthorizedError("Not signed in");
  if (!orgId) throw new UnauthorizedError("No active organization");
  return withTenant({ sub: userId, org_id: orgId, org_role: orgRole ?? undefined }, fn);
}
