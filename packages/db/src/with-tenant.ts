import { sql } from "drizzle-orm";
import { getDb, type Tx } from "./client";

/**
 * Tenant identity, shaped like the Clerk session-token claims that Postgres RLS
 * reads. Resolved to OUR uuids inside the `app.*` helper functions, so the keys
 * must stay `sub` / `org_id` / `org_role` (plan.md rule 2).
 */
export type TenantClaims = {
  /** Clerk user id (`user_…`). */
  sub: string;
  /** Clerk organization id (`org_…`). */
  org_id: string;
  /** Clerk org role (`org:admin` / `org:member`). */
  org_role?: string;
};

/**
 * Run `fn` as the tenant described by `claims`, with RLS enforced.
 *
 * Opens one transaction, injects the claims transaction-locally via
 * `set_config(..., true)` and downgrades to the `authenticated` role. Because
 * `SET LOCAL` dies with the transaction, a pooled backend connection can never
 * leak one tenant's identity into the next request (plan.md rule 1).
 *
 * This is also the test seam: the cross-tenant isolation test calls it directly
 * with synthetic claims, bypassing Clerk.
 */
export async function withTenant<T>(
  claims: TenantClaims,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  const payload = JSON.stringify(claims);
  return getDb().transaction(async (tx) => {
    await tx.execute(sql`select set_config('request.jwt.claims', ${payload}, true)`);
    await tx.execute(sql`set local role authenticated`);
    return fn(tx);
  });
}

/**
 * Run `fn` with RLS bypassed (the connection owner role). For webhook handlers
 * and Inngest steps that have no user session. There is NO safety net here:
 * every read/write MUST be scoped by our ids in code. Server-only; never
 * reachable from a request that carries a client session (plan.md rule 1, 7).
 */
export async function withService<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return getDb().transaction(async (tx) => fn(tx));
}
