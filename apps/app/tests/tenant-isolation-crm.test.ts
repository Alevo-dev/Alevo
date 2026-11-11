import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, inArray, sql } from "drizzle-orm";
import {
  consents,
  contacts,
  conversations,
  emailSuppressions,
  kbDocuments,
  memberships,
  messages,
  organizations,
  users,
  withService,
  withTenant,
  type TenantClaims,
} from "@alevo/db";

/**
 * Cross-tenant isolation for the tables that hold lead data: contacts,
 * conversations, messages, consents, suppressions and knowledge documents.
 * tenant-isolation.test.ts covers the identity and billing tables; this covers
 * what a leaked row would actually expose. Real Postgres, real RLS.
 */

const ORG_A = "org_test_crm_a";
const ORG_B = "org_test_crm_b";
const USER_A = "user_test_crm_a";
const USER_B = "user_test_crm_b";
const claimsA: TenantClaims = { sub: USER_A, org_id: ORG_A };

let orgA: string;
let orgB: string;
let contactB: string;
let conversationB: string;

beforeAll(async () => {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL must point at a local Supabase Postgres for this test");
  await cleanup();
  await withService(async (tx) => {
    const orgs = await tx
      .insert(organizations)
      .values([{ clerkId: ORG_A, name: "CRM A" }, { clerkId: ORG_B, name: "CRM B" }])
      .returning({ id: organizations.id, clerkId: organizations.clerkId });
    orgA = orgs.find((o) => o.clerkId === ORG_A)!.id;
    orgB = orgs.find((o) => o.clerkId === ORG_B)!.id;
    const us = await tx
      .insert(users)
      .values([{ clerkId: USER_A, email: "crm-a@test.dev" }, { clerkId: USER_B, email: "crm-b@test.dev" }])
      .returning({ id: users.id, clerkId: users.clerkId });
    await tx.insert(memberships).values([
      { orgId: orgA, userId: us.find((u) => u.clerkId === USER_A)!.id, role: "owner" },
      { orgId: orgB, userId: us.find((u) => u.clerkId === USER_B)!.id, role: "owner" },
    ]);

    for (const [orgId, tag] of [[orgA, "a"], [orgB, "b"]] as const) {
      const [c] = await tx
        .insert(contacts)
        .values({ orgId, email: `lead-${tag}@example.com`, phone: tag === "a" ? "+16135550191" : "+16135550192", firstName: `Lead${tag}` })
        .returning({ id: contacts.id });
      const [conv] = await tx
        .insert(conversations)
        .values({ orgId, contactId: c!.id, channel: "form" })
        .returning({ id: conversations.id });
      await tx.insert(messages).values({ orgId, conversationId: conv!.id, direction: "inbound", author: "contact", channel: "form", body: `secret-${tag}` });
      await tx.insert(consents).values({ orgId, contactId: c!.id, channel: "email", basis: "test" });
      await tx.insert(emailSuppressions).values({ orgId, email: `nope-${tag}@example.com`, reason: "unsubscribe" });
      await tx.insert(kbDocuments).values({ orgId, title: `doc-${tag}`, sourceType: "text", sourceRef: `private-${tag}` });
      if (tag === "b") {
        contactB = c!.id;
        conversationB = conv!.id;
      }
    }
  });
});

afterAll(cleanup);

async function cleanup() {
  await withService(async (tx) => {
    await tx.delete(organizations).where(inArray(organizations.clerkId, [ORG_A, ORG_B])); // everything cascades
    await tx.delete(users).where(inArray(users.clerkId, [USER_A, USER_B]));
  });
}

describe("lead data never crosses tenants", () => {
  it("org A reads only its own contacts, conversations, messages, consents, suppressions and documents", async () => {
    await withTenant(claimsA, async (tx) => {
      for (const table of [contacts, conversations, messages, consents, emailSuppressions, kbDocuments]) {
        const rows = await tx.select({ orgId: table.orgId }).from(table);
        expect(rows.length, "A should see its own row").toBeGreaterThan(0);
        expect(rows.every((r) => r.orgId === orgA)).toBe(true);
      }
    });
  });

  it("org A cannot fetch org B's rows even by exact id", async () => {
    await withTenant(claimsA, async (tx) => {
      expect(await tx.select().from(contacts).where(eq(contacts.id, contactB))).toHaveLength(0);
      expect(await tx.select().from(conversations).where(eq(conversations.id, conversationB))).toHaveLength(0);
      expect(await tx.select().from(messages).where(eq(messages.conversationId, conversationB))).toHaveLength(0);
    });
  });

  it("org A cannot change or delete org B's contact", async () => {
    await withTenant(claimsA, async (tx) => {
      const upd = await tx.update(contacts).set({ firstName: "pwned" }).where(eq(contacts.id, contactB)).returning({ id: contacts.id });
      const del = await tx.delete(contacts).where(eq(contacts.id, contactB)).returning({ id: contacts.id });
      expect(upd).toHaveLength(0);
      expect(del).toHaveLength(0);
    });
    const [still] = await withService((tx) => tx.select({ firstName: contacts.firstName }).from(contacts).where(eq(contacts.id, contactB)));
    expect(still?.firstName).toBe("Leadb");
  });

  it("org A cannot plant rows in org B", async () => {
    await expect(
      withTenant(claimsA, (tx) => tx.insert(contacts).values({ orgId: orgB, email: "planted@example.com" })),
    ).rejects.toThrow();
    await expect(
      withTenant(claimsA, (tx) =>
        tx.insert(messages).values({ orgId: orgB, conversationId: conversationB, direction: "inbound", author: "contact", channel: "form", body: "planted" }),
      ),
    ).rejects.toThrow();
  });
});

describe("row-level security covers the whole schema", () => {
  it("every table in public has RLS enabled, so a new migration cannot forget it", async () => {
    const rows = await withService((tx) =>
      tx.execute<{ name: string }>(sql`
        select c.relname as name
        from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
        order by 1`),
    );
    expect(rows.map((r) => r.name)).toEqual([]);
  });
});
