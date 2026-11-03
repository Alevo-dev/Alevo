import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import {
  auditLog,
  calls,
  claimIdentity,
  consents,
  contacts,
  conversations,
  keeperOf,
  meetings,
  organizations,
  psaLinks,
  resolveContact,
  withService,
} from "@alevo/db";

/**
 * One contact per person and org. The resolver finds by email or phone, fills
 * what it learns, and when a touch proves two rows are the same person it merges
 * them: the older keeps its id, everything moves, the newer is deleted, an audit
 * row says so. Real DB; skipped without DATABASE_URL.
 */
const HAS_DB = Boolean(process.env.DATABASE_URL);
const stamp = Date.now();
let orgId = "";

const insertContact = (values: Partial<typeof contacts.$inferInsert>) =>
  withService(async (tx) => {
    const [row] = await tx.insert(contacts).values({ orgId, ...values }).returning({ id: contacts.id });
    return row!.id;
  });
const insertConversation = (contactId: string, channel: "form" | "voice" | "sms" = "form") =>
  withService(async (tx) => {
    const [row] = await tx.insert(conversations).values({ orgId, contactId, channel, status: "new" }).returning({ id: conversations.id });
    return row!.id;
  });
const contactById = (id: string) => withService((tx) => tx.select().from(contacts).where(eq(contacts.id, id))).then((r) => r[0]);

beforeAll(async () => {
  if (!HAS_DB) return;
  const [org] = await withService((tx) =>
    tx.insert(organizations).values({ clerkId: `org_test_resolve_${stamp}`, name: "Resolve test" }).returning({ id: organizations.id }),
  );
  orgId = org!.id;
});

afterAll(async () => {
  if (!HAS_DB || !orgId) return;
  await withService((tx) => tx.delete(organizations).where(eq(organizations.id, orgId)));
});

describe("keeperOf", () => {
  it("prefers the older row, then the smaller id", () => {
    const older = { id: "b", createdAt: new Date("2026-01-01") };
    const newer = { id: "a", createdAt: new Date("2026-02-01") };
    expect(keeperOf(older, newer)).toBe("a");
    expect(keeperOf(newer, older)).toBe("b");
    expect(keeperOf({ id: "a", createdAt: older.createdAt }, { id: "b", createdAt: older.createdAt })).toBe("a");
  });
});

describe.skipIf(!HAS_DB)("resolveContact", () => {
  it("creates once and reuses by email, case-insensitively", async () => {
    const first = await resolveContact(orgId, { email: `Case-${stamp}@Example.com` }, { firstName: "Casey", source: "form" });
    const again = await resolveContact(orgId, { email: `case-${stamp}@example.com` });
    expect(again).toEqual({ id: first.id, merged: false });
    expect((await contactById(first.id))?.email).toBe(`case-${stamp}@example.com`);
  });

  it("reuses by normalised phone and fills empty fields only", async () => {
    const first = await resolveContact(orgId, { phone: "613-555-0100" }, { source: "sms" });
    const again = await resolveContact(orgId, { phone: "+16135550100" }, { firstName: "Pat", company: "Acme" });
    expect(again.id).toBe(first.id);
    const row = await contactById(first.id);
    expect(row?.phone).toBe("+16135550100");
    expect(row?.firstName).toBe("Pat");
    expect(row?.source).toBe("sms");
  });

  it("always creates when it knows nothing (chat visitor)", async () => {
    const a = await resolveContact(orgId, {}, { source: "chat" });
    const b = await resolveContact(orgId, {}, { source: "chat" });
    expect(a.id).not.toBe(b.id);
  });

  it("merges an email-only and a phone-only contact when one touch carries both", async () => {
    const email = `merge-${stamp}@example.com`;
    const phone = "+16135550101";
    const a = await insertContact({ email, firstName: "Older", source: "form" });
    await new Promise((r) => setTimeout(r, 5));
    const b = await insertContact({ phone, company: "Phone Co", source: "voice" });
    const convA = await insertConversation(a);
    const convB = await insertConversation(b, "voice");
    await withService(async (tx) => {
      await tx.insert(consents).values({ orgId, contactId: b, channel: "voice", basis: "inbound_call", verbatim: null, source: "voice" });
      await tx.insert(meetings).values({ orgId, contactId: b, conversationId: convB, provider: "google", providerRef: `m-${stamp}`, status: "scheduled" });
      await tx.insert(calls).values({ orgId, contactId: b, conversationId: convB, providerRef: `c-${stamp}` });
    });

    const r = await resolveContact(orgId, { email, phone });
    expect(r).toEqual({ id: a, merged: true });

    expect(await contactById(b)).toBeUndefined();
    const keeper = await contactById(a);
    expect(keeper?.phone).toBe(phone);
    expect(keeper?.company).toBe("Phone Co");
    expect(keeper?.firstName).toBe("Older");

    const moved = await withService(async (tx) => ({
      conversations: await tx.select({ id: conversations.id }).from(conversations).where(eq(conversations.contactId, a)),
      consents: await tx.select({ id: consents.id }).from(consents).where(eq(consents.contactId, a)),
      meetings: await tx.select({ id: meetings.id }).from(meetings).where(eq(meetings.contactId, a)),
      calls: await tx.select({ id: calls.id }).from(calls).where(eq(calls.contactId, a)),
      audit: await tx.select({ target: auditLog.target }).from(auditLog).where(and(eq(auditLog.orgId, orgId), eq(auditLog.action, "contact.merged"))),
    }));
    expect(moved.conversations.map((c) => c.id).sort()).toEqual([convA, convB].sort());
    expect(moved.consents).toHaveLength(1);
    expect(moved.meetings).toHaveLength(1);
    expect(moved.calls).toHaveLength(1);
    expect(moved.audit.map((x) => x.target)).toContain(b);
  });

  it("carries the loser's newest activity and details into the keeper (list order + an un-merge trail)", async () => {
    const email = `act-${stamp}@example.com`;
    const phone = "+16135550104";
    const a = await insertContact({ email, source: "form" });
    await new Promise((r) => setTimeout(r, 20));
    const b = await insertContact({ phone, firstName: "Bea", company: "Bea Co", source: "voice" });
    await insertConversation(b, "voice"); // bumps B's last_activity_at past A's
    const [before] = await withService((tx) => tx.select({ at: contacts.lastActivityAt }).from(contacts).where(eq(contacts.id, b)));

    await resolveContact(orgId, { email, phone });
    const keeper = await contactById(a);
    expect(keeper?.lastActivityAt.getTime()).toBeGreaterThanOrEqual(before!.at.getTime());

    const [audit] = await withService((tx) =>
      tx.select({ metadata: auditLog.metadata }).from(auditLog).where(and(eq(auditLog.action, "contact.merged"), eq(auditLog.target, b))),
    );
    expect(audit?.metadata).toMatchObject({ into: a, loser: { phone, firstName: "Bea", company: "Bea Co", source: "voice" } });
  });
});

describe.skipIf(!HAS_DB)("resolveContact — form touches and the index", () => {
  it("a form touch overwrites name, company and phone; any other touch fills gaps only", async () => {
    const email = `form-${stamp}@example.com`;
    const id = (await resolveContact(orgId, { email, phone: "+16135550105" }, { firstName: "Old", lastName: "Name", company: "Old Co", source: "form" })).id;
    await resolveContact(orgId, { email }, { firstName: "Heard", company: "Heard Co", source: "voice" });
    expect(await contactById(id)).toMatchObject({ firstName: "Old", company: "Old Co", phone: "+16135550105" });
    await resolveContact(orgId, { email, phone: "613-555-0106" }, { firstName: "New", lastName: null, company: "New Co", source: "form" });
    expect(await contactById(id)).toMatchObject({ firstName: "New", lastName: null, company: "New Co", phone: "+16135550106" });
  });

  it("the database refuses a second contact with the same email or phone", async () => {
    const email = `uniq-${stamp}@example.com`;
    await insertContact({ email, phone: "+16135550107" });
    await expect(insertContact({ email: email.toUpperCase() })).rejects.toMatchObject({ code: "23505" });
    await expect(insertContact({ phone: "+16135550107" })).rejects.toMatchObject({ code: "23505" });
  });

  it("moves the loser's PSA links onto the keeper, dropping one that would duplicate", async () => {
    const email = `psa-${stamp}@example.com`;
    const phone = "+16135550108";
    const a = await insertContact({ email, source: "form" });
    await new Promise((r) => setTimeout(r, 5));
    const b = await insertContact({ phone, source: "voice" });
    await withService((tx) =>
      tx.insert(psaLinks).values([
        { orgId, provider: "connectwise", kind: "contact", localId: a, remoteId: "cw-a" },
        { orgId, provider: "connectwise", kind: "contact", localId: b, remoteId: "cw-b" },
        { orgId, provider: "halo", kind: "contact", localId: b, remoteId: "halo-b" },
      ]),
    );
    await resolveContact(orgId, { email, phone });
    const links = await withService((tx) => tx.select({ provider: psaLinks.provider, localId: psaLinks.localId, remoteId: psaLinks.remoteId }).from(psaLinks).where(eq(psaLinks.orgId, orgId)));
    expect(links.filter((l) => l.localId === b)).toEqual([]);
    expect(links.filter((l) => l.localId === a).map((l) => l.remoteId).sort()).toEqual(["cw-a", "halo-b"]);
  });
});

describe.skipIf(!HAS_DB)("claimIdentity", () => {
  it("keeps the keeper's email when both have one, and moves the loser's thread", async () => {
    const a = await insertContact({ email: `a-${stamp}@example.com`, source: "form" });
    await new Promise((r) => setTimeout(r, 5));
    const b = await insertContact({ email: `b-${stamp}@example.com`, phone: "+16135550102", source: "chat" });
    const convB = await insertConversation(b, "sms");

    const r = await claimIdentity(orgId, b, { email: `A-${stamp}@example.com` });
    expect(r).toEqual({ id: a, merged: true });
    const keeper = await contactById(a);
    expect(keeper?.email).toBe(`a-${stamp}@example.com`);
    expect(keeper?.phone).toBe("+16135550102");
    expect(await contactById(b)).toBeUndefined();
    const [conv] = await withService((tx) => tx.select({ contactId: conversations.contactId }).from(conversations).where(eq(conversations.id, convB)));
    expect(conv?.contactId).toBe(a);
  });

  it("just sets a fresh identity", async () => {
    const c = await insertContact({ source: "chat" });
    const r = await claimIdentity(orgId, c, { phone: "(613) 555-0103" });
    expect(r).toEqual({ id: c, merged: false });
    expect((await contactById(c))?.phone).toBe("+16135550103");
  });

  it("ignores a blank identity", async () => {
    const c = await insertContact({ source: "chat" });
    expect(await claimIdentity(orgId, c, { email: "", phone: null })).toEqual({ id: c, merged: false });
  });
});
