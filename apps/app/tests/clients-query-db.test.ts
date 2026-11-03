import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { contacts, conversations, organizations, withService } from "@alevo/db";
import { clientDetail } from "../lib/clients/detail";
import { clientCount, clientsPage } from "../lib/clients/queries";

/**
 * The clients list: one row per contact, most recent activity first, with what
 * the row shows (channels, latest status, best fit, open count). Real DB; needs
 * migration 0038; skipped without DATABASE_URL.
 */
const HAS_DB = Boolean(process.env.DATABASE_URL);
const stamp = Date.now();
let orgId = "";
let a = "";
let b = "";
let c = "";

const pause = () => new Promise((r) => setTimeout(r, 5));

beforeAll(async () => {
  if (!HAS_DB) return;
  const [org] = await withService((tx) =>
    tx.insert(organizations).values({ clerkId: `org_test_clients_${stamp}`, name: "Clients test" }).returning({ id: organizations.id }),
  );
  orgId = org!.id;
  const add = (values: Partial<typeof contacts.$inferInsert>) =>
    withService(async (tx) => (await tx.insert(contacts).values({ orgId, ...values }).returning({ id: contacts.id }))[0]!.id);
  const talk = (contactId: string, channel: "form" | "sms" | "voice", status: "booked" | "active" | "handed_off", fitScore: number | null) =>
    withService((tx) => tx.insert(conversations).values({ orgId, contactId, channel, status, fitScore }));

  // C: no conversations. B: one voice hand-off. A: form (booked, 80) then sms (active, 40) — the latest touch.
  c = await add({ email: `c-${stamp}@example.com`, firstName: "Cee", source: "form" });
  await pause();
  b = await add({ phone: "+15550000011", source: "voice" });
  await talk(b, "voice", "handed_off", null);
  await pause();
  a = await add({ email: `a-${stamp}@example.com`, firstName: "Ann", company: "Acme", source: "form" });
  await talk(a, "form", "booked", 80);
  await pause();
  await talk(a, "sms", "active", 40);
});

afterAll(async () => {
  if (!HAS_DB || !orgId) return;
  await withService((tx) => tx.delete(organizations).where(eq(organizations.id, orgId)));
});

describe.skipIf(!HAS_DB)("clientsPage", () => {
  it("lists one row per client, most recent activity first, with the row's facts", async () => {
    const page = await withService((tx) => clientsPage(tx, orgId, null));
    expect(page.rows.map((r) => r.id)).toEqual([a, b, c]);
    expect(page.older).toBeNull();
    expect(page.newer).toBeNull();

    const ann = page.rows[0]!;
    expect(ann).toMatchObject({ firstName: "Ann", company: "Acme", channels: ["form", "sms"], latestStatus: "active", maxFit: 80, openCount: 1 });

    const cee = page.rows[2]!;
    expect(cee).toMatchObject({ channels: [], latestStatus: null, maxFit: null, openCount: 0 });
    expect(cee.lastActivityAt).toBeInstanceOf(Date);
  });

  it("counts clients for the header", async () => {
    expect(await withService((tx) => clientCount(tx, orgId))).toBe(3);
  });
});

describe.skipIf(!HAS_DB)("clientDetail", () => {
  it("returns the contact and their conversations newest first", async () => {
    const d = await withService((tx) => clientDetail(tx, orgId, a));
    expect(d?.contact.firstName).toBe("Ann");
    expect(d?.conversations.map((c) => c.channel)).toEqual(["sms", "form"]);
    expect(d?.conversations[1]).toMatchObject({ status: "booked", fitScore: 80, lastPreview: null, callOutcome: null });
    expect(d?.conversations[0]!.lastEntryAt).toBeInstanceOf(Date);
    expect(d?.consents).toEqual([]);
    expect(d?.suppressed).toBeNull();
    expect(d?.capped).toBe(false);
  });

  it("is null for an unknown or another org's contact", async () => {
    expect(await withService((tx) => clientDetail(tx, orgId, "00000000-0000-4000-8000-000000000000"))).toBeNull();
  });
});
