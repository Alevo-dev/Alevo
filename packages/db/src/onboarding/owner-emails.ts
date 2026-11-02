import { and, eq, inArray } from "drizzle-orm";
import { memberships, users } from "../schema/identity";
import { withService } from "../with-tenant";

/**
 * Email addresses of the org's owners and admins — who gets the account-level
 * emails. Alevo support members (migration 0030) are never on the list.
 */
export async function ownerEmails(orgId: string): Promise<string[]> {
  const rows = await withService((tx) =>
    tx
      .select({ email: users.email })
      .from(memberships)
      .innerJoin(users, eq(users.id, memberships.userId))
      .where(and(eq(memberships.orgId, orgId), inArray(memberships.role, ["owner", "admin"]), eq(memberships.support, false))),
  );
  return rows.map((r) => r.email).filter((e): e is string => Boolean(e));
}
