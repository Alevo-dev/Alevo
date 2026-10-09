import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, inArray, sql } from "drizzle-orm";
import {
  memberships,
  orgSubscriptions,
  organizations,
  plans,
  users,
  withService,
  withTenant,
  type TenantClaims,
} from "@alevo/db";

/**
 * The rule-1 proof (plan.md): org A must not be able to read org B's rows.
 * Runs against the real local Supabase Postgres so RLS is actually exercised;
 * a mock would prove nothing. The synthetic claims passed to withTenant are the
 * test seam — they stand in for a verified Clerk session.
 */

const ORG_A = "org_test_a";
const ORG_B = "org_test_b";
const USER_A = "user_test_a";
const USER_B = "user_test_b";

const claimsA: TenantClaims = { sub: USER_A, org_id: ORG_A };
const claimsB: TenantClaims = { sub: USER_B, org_id: ORG_B };

let orgAId: string;
let orgBId: string;

beforeAll(async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL must point at a local Supabase Postgres for this test");
  }
  await cleanup();

  await withService(async (tx) => {
    const orgs = await tx
      .insert(organizations)
      .values([
        { clerkId: ORG_A, name: "Org A" },
        { clerkId: ORG_B, name: "Org B" },
      ])
      .returning({ id: organizations.id, clerkId: organizations.clerkId });

    const insertedUsers = await tx
      .insert(users)
      .values([
        { clerkId: USER_A, email: "a@test.dev" },
        { clerkId: USER_B, email: "b@test.dev" },
      ])
      .returning({ id: users.id, clerkId: users.clerkId });

    const byClerk = (rows: { id: string; clerkId: string }[]) =>
      Object.fromEntries(rows.map((r) => [r.clerkId, r.id]));
    const orgIds = byClerk(orgs);
    const userIds = byClerk(insertedUsers);
    orgAId = orgIds[ORG_A]!;
    orgBId = orgIds[ORG_B]!;

    await tx.insert(memberships).values([
      { orgId: orgAId, userId: userIds[USER_A]!, role: "owner" },
      { orgId: orgBId, userId: userIds[USER_B]!, role: "owner" },
    ]);

    // Give each org a subscription to the seeded Starter plan (for the
    // billing-isolation assertions below).
    const [starter] = await tx
      .select({ id: plans.id })
      .from(plans)
      .where(eq(plans.key, "starter"));
    if (!starter) throw new Error("Starter plan not seeded — run migration 0002");
    await tx.insert(orgSubscriptions).values([
      { orgId: orgAId, planId: starter.id },
      { orgId: orgBId, planId: starter.id },
    ]);
  });
});

afterAll(cleanup);

async function cleanup() {
  await withService(async (tx) => {
    const orgRows = await tx
      .delete(organizations)
      .where(inArray(organizations.clerkId, [ORG_A, ORG_B]))
      .returning({ id: organizations.id }); // memberships cascade
    void orgRows;
    await tx.delete(users).where(inArray(users.clerkId, [USER_A, USER_B]));
  });
}

describe("cross-tenant isolation", () => {
  it("org A sees only its own organization row", async () => {
    const rows = await withTenant(claimsA, (tx) =>
      tx.select({ id: organizations.id, clerkId: organizations.clerkId }).from(organizations),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.clerkId).toBe(ORG_A);
  });

  it("org A cannot read org B's organization even when querying by id", async () => {
    const rows = await withTenant(claimsA, (tx) =>
      tx.select().from(organizations).where(sql`${organizations.id} = ${orgBId}`),
    );
    expect(rows).toHaveLength(0);
  });

  it("isolation is symmetric — org B sees only its own organization row", async () => {
    const rows = await withTenant(claimsB, (tx) =>
      tx.select({ clerkId: organizations.clerkId }).from(organizations),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.clerkId).toBe(ORG_B);
  });

  it("org A sees only its own memberships", async () => {
    const rows = await withTenant(claimsA, (tx) =>
      tx.select({ orgId: memberships.orgId }).from(memberships),
    );
    expect(rows.every((r) => r.orgId === orgAId)).toBe(true);
    expect(rows.length).toBeGreaterThan(0);
  });

  it("current_role() resolves to the caller's role in the active org", async () => {
    const role = await withTenant(claimsA, async (tx) => {
      const r = await tx.execute<{ role: string | null }>(sql`select app.current_role() as role`);
      return r[0]?.role ?? null;
    });
    expect(role).toBe("owner");
  });

  it("plans reference data is readable by any tenant", async () => {
    const rows = await withTenant(claimsA, (tx) =>
      tx.select({ key: plans.key }).from(plans),
    );
    const keys = rows.map((r) => r.key).sort();
    expect(keys).toEqual(["growth", "scale", "starter"]);
  });

  it("org A sees only its own subscription", async () => {
    const rows = await withTenant(claimsA, (tx) =>
      tx.select({ orgId: orgSubscriptions.orgId }).from(orgSubscriptions),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.orgId).toBe(orgAId);
  });

  it("a platform admin reads all orgs, but current-org scoping stays correct", async () => {
    // Regression: getCurrentOrg must filter on app.current_org_id() explicitly.
    // A platform admin can read every org, so an unfiltered read returns many.
    await withService((tx) =>
      tx.update(users).set({ isPlatformAdmin: true }).where(eq(users.clerkId, USER_A)),
    );
    try {
      const all = await withTenant(claimsA, (tx) =>
        tx
          .select({ clerkId: organizations.clerkId })
          .from(organizations)
          .where(inArray(organizations.clerkId, [ORG_A, ORG_B])),
      );
      expect(all).toHaveLength(2); // admin sees both orgs

      const scoped = await withTenant(claimsA, (tx) =>
        tx
          .select({ clerkId: organizations.clerkId })
          .from(organizations)
          .where(sql`${organizations.id} = (select app.current_org_id())`),
      );
      expect(scoped).toHaveLength(1); // explicit scoping still resolves one
      expect(scoped[0]!.clerkId).toBe(ORG_A);

      // Same footgun on memberships (the Members page query): unfiltered leaks
      // across orgs for an admin; explicit org scoping returns only the active org.
      const allMemberships = await withTenant(claimsA, (tx) =>
        tx.select({ orgId: memberships.orgId }).from(memberships),
      );
      expect(allMemberships.length).toBeGreaterThanOrEqual(2);

      const scopedMemberships = await withTenant(claimsA, (tx) =>
        tx
          .select({ orgId: memberships.orgId })
          .from(memberships)
          .where(sql`${memberships.orgId} = (select app.current_org_id())`),
      );
      expect(scopedMemberships).toHaveLength(1);
      expect(scopedMemberships[0]!.orgId).toBe(orgAId);
    } finally {
      await withService((tx) =>
        tx.update(users).set({ isPlatformAdmin: false }).where(eq(users.clerkId, USER_A)),
      );
    }
  });

  it("the service path (RLS bypass) sees every tenant", async () => {
    const rows = await withService((tx) =>
      tx
        .select({ clerkId: organizations.clerkId })
        .from(organizations)
        .where(inArray(organizations.clerkId, [ORG_A, ORG_B])),
    );
    expect(rows).toHaveLength(2);
  });
});
