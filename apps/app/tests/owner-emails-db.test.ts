import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { inArray } from "drizzle-orm";
import { memberships, organizations, ownerEmails, users, withService } from "@alevo/db";

/**
 * Alevo support members (platform admins joined as support, migration 0030) never
 * receive an org's account-level emails; the org's real owners and admins do. A
 * platform admin who genuinely owns an org (the founder's own workspace) is a real
 * owner there and is listed. Seeds its own org and users, so it does not depend on
 * what happens to be in the shared dev database.
 */
const ORG = "org_test_owner_emails";
const CLERK_USERS = ["user_oe_owner", "user_oe_admin", "user_oe_member", "user_oe_support", "user_oe_founder"];
const EMAIL = (k: string) => `${k}@oe-test.dev`;

beforeAll(async () => {
  await cleanup();
  await withService(async (tx) => {
    const [org] = await tx.insert(organizations).values({ clerkId: ORG, name: "OE test" }).returning({ id: organizations.id });
    const rows = await tx
      .insert(users)
      .values([
        { clerkId: "user_oe_owner", email: EMAIL("owner") },
        { clerkId: "user_oe_admin", email: EMAIL("admin") },
        { clerkId: "user_oe_member", email: EMAIL("member") },
        { clerkId: "user_oe_support", email: EMAIL("support"), isPlatformAdmin: true },
        { clerkId: "user_oe_founder", email: EMAIL("founder"), isPlatformAdmin: true },
      ])
      .returning({ id: users.id, clerkId: users.clerkId });
    const id = (c: string) => rows.find((r) => r.clerkId === c)!.id;
    await tx.insert(memberships).values([
      { orgId: org!.id, userId: id("user_oe_owner"), role: "owner" },
      { orgId: org!.id, userId: id("user_oe_admin"), role: "admin" },
      { orgId: org!.id, userId: id("user_oe_member"), role: "rep" },
      { orgId: org!.id, userId: id("user_oe_support"), role: "admin", support: true },
      { orgId: org!.id, userId: id("user_oe_founder"), role: "owner", support: false },
    ]);
  });
});

afterAll(cleanup);

async function orgId(): Promise<string> {
  const [row] = await withService((tx) => tx.select({ id: organizations.id }).from(organizations).where(inArray(organizations.clerkId, [ORG])));
  if (!row) throw new Error("test org missing");
  return row.id;
}

async function cleanup() {
  await withService(async (tx) => {
    await tx.delete(organizations).where(inArray(organizations.clerkId, [ORG]));
    await tx.delete(users).where(inArray(users.clerkId, CLERK_USERS));
  });
}

describe("ownerEmails", () => {
  it("lists real owners and admins, and nobody else", async () => {
    const id = await orgId();
    const emails = await ownerEmails(id);
    expect(emails.sort()).toEqual([EMAIL("admin"), EMAIL("founder"), EMAIL("owner")].sort());
  });

  it("never lists a support member, even one with the admin role", async () => {
    const id = await orgId();
    expect(await ownerEmails(id)).not.toContain(EMAIL("support"));
  });
});
