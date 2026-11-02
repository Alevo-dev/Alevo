import { describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { memberships, ownerEmails, users, withService } from "@alevo/db";

/**
 * Alevo support members (platform admins, migration 0030) never receive the
 * account-level emails. Read-only check over the real database: for every org
 * with members, `ownerEmails` contains no platform admin's address. Skipped
 * without DATABASE_URL.
 */
describe("ownerEmails excludes support members", () => {
  it("never lists a platform admin", async () => {
    if (!process.env.DATABASE_URL) return;
    const [orgs, admins] = await Promise.all([
      withService((tx) => tx.selectDistinct({ orgId: memberships.orgId }).from(memberships)),
      withService((tx) => tx.select({ email: users.email }).from(users).where(eq(users.isPlatformAdmin, true))),
    ]);
    const adminEmails = new Set(admins.map((a) => a.email).filter(Boolean));
    for (const { orgId } of orgs) {
      for (const email of await ownerEmails(orgId)) expect(adminEmails.has(email)).toBe(false);
    }
    // Sanity: the query ran against a schema that has the column.
    const [row] = await withService((tx) => tx.select({ n: sql<number>`count(*)`.mapWith(Number) }).from(memberships).where(eq(memberships.support, true)));
    expect(row?.n).toBeGreaterThanOrEqual(0);
  });
});
