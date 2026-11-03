import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { calls, contacts, conversations, messages, organizations, withService } from "@alevo/db";

/**
 * `contacts.last_activity_at` orders the clients list. The database keeps it: an
 * insert on conversations, messages or calls bumps the contact (migration 0038).
 * Real DB; skipped without DATABASE_URL.
 */
const HAS_DB = Boolean(process.env.DATABASE_URL);
let orgId = "";

beforeAll(async () => {
  if (!HAS_DB) return;
  const [org] = await withService((tx) =>
    tx.insert(organizations).values({ clerkId: `org_test_activity_${Date.now()}`, name: "Activity test" }).returning({ id: organizations.id }),
  );
  orgId = org!.id;
});

afterAll(async () => {
  if (!HAS_DB || !orgId) return;
  await withService((tx) => tx.delete(organizations).where(eq(organizations.id, orgId)));
});

const activity = (id: string) =>
  withService((tx) => tx.select({ at: contacts.lastActivityAt }).from(contacts).where(eq(contacts.id, id))).then((r) => r[0]?.at ?? null);

describe.skipIf(!HAS_DB)("contacts.last_activity_at", () => {
  it("follows the newest conversation, message and call", async () => {
    const [contact] = await withService((tx) =>
      tx.insert(contacts).values({ orgId, phone: "+15550000008", source: "voice" }).returning({ id: contacts.id, createdAt: contacts.createdAt }),
    );
    const id = contact!.id;
    // No touch yet: creation counts, so the list never meets a null.
    expect((await activity(id))?.getTime()).toBe(contact!.createdAt.getTime());

    const [conv] = await withService((tx) =>
      tx.insert(conversations).values({ orgId, contactId: id, channel: "voice", status: "new" }).returning({ id: conversations.id, createdAt: conversations.createdAt }),
    );
    expect((await activity(id))?.getTime()).toBe(conv!.createdAt.getTime());

    const [msg] = await withService((tx) =>
      tx
        .insert(messages)
        .values({ orgId, conversationId: conv!.id, direction: "inbound", author: "contact", channel: "voice", body: "Hello" })
        .returning({ createdAt: messages.createdAt }),
    );
    expect((await activity(id))?.getTime()).toBe(msg!.createdAt.getTime());

    const [call] = await withService((tx) =>
      tx.insert(calls).values({ orgId, contactId: id, conversationId: conv!.id, providerRef: `act-${Date.now()}` }).returning({ createdAt: calls.createdAt }),
    );
    expect((await activity(id))?.getTime()).toBe(call!.createdAt.getTime());
  });
});
