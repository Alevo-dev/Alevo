import "server-only";
import { cache } from "react";
import { sql } from "drizzle-orm";
import type { AppRole } from "@alevo/db";
import { getCurrentUser } from "./current-user";
import { withOrg } from "./session";
import { ForbiddenError, UnauthorizedError } from "./errors";

/** Role hierarchy: a higher rank satisfies any requirement at or below it. */
const RANK: Record<AppRole, number> = { viewer: 0, rep: 1, admin: 2, owner: 3 };

/** The caller's role in the active org (our DB, not Clerk — rule 4). Deduped per request. */
const currentRole = cache(async (): Promise<AppRole | null> =>
  withOrg(async (tx) => {
    const rows = await tx.execute<{ role: AppRole | null }>(sql`select app.current_role() as role`);
    return rows[0]?.role ?? null;
  }),
);

/**
 * Assert the caller's role in the active org is at least `minimum`. Reads the
 * canonical role via `app.current_role()`. Returns the resolved role so callers
 * can branch further. The role lookup itself runs once per request.
 */
export async function requireRole(minimum: AppRole): Promise<AppRole> {
  const role = await currentRole();
  if (!role) throw new UnauthorizedError("No membership in the active organization");
  if (RANK[role] < RANK[minimum]) {
    throw new ForbiddenError(`Requires ${minimum}; you are ${role}`);
  }
  return role;
}

/** Assert the caller is an Alevo platform (super) admin. */
export async function requirePlatformAdmin() {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError();
  if (!user.isPlatformAdmin) throw new ForbiddenError("Platform admin only");
  return user;
}
