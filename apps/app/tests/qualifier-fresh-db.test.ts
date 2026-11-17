import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { contacts, conversations, messages, organizations, withService } from "@alevo/db";
import { contactMessagesNotIn } from "../lib/qualifier/fresh";

/**
 * The agent is handed contact messages that arrived while it worked. They are told apart by id: Postgres keeps
 * microseconds and a JS Date only milliseconds, so a timestamp comparison made the contact's OWN message look new
 * and the agent answered it three times. Real DB; skipped without DATABASE_URL.
 */
const HAS_DB = Boolean(process.env.DATABASE_URL);
let orgId = "";
let conversationId = "";

const add = (author: "contact" | "assistant", body: string) =>
  withService(async (tx) => {
    const [m] = await tx
      .insert(messages)
      .values({ orgId, conversationId, direction: author === "contact" ? "inbound" : "outbound", author, channel: "chat", body })
      .returning({ id: messages.id });
    return m!.id;
  });

let contactId = "";

/** A fresh conversation per test, so one test's messages never show up in another. */
const newConversation = () =>
  withService(async (tx) => {
    const [conv] = await tx.insert(conversations).values({ orgId, contactId, channel: "chat", status: "new" }).returning({ id: conversations.id });
    conversationId = conv!.id;
  });

beforeAll(async () => {
  if (!HAS_DB) return;
  await withService(async (tx) => {
    const [org] = await tx.insert(organizations).values({ clerkId: `org_test_fresh_${Date.now()}`, name: "Fresh test" }).returning({ id: organizations.id });
    orgId = org!.id;
    const [contact] = await tx.insert(contacts).values({ orgId, source: "chat" }).returning({ id: contacts.id });
    contactId = contact!.id;
  });
});

afterAll(async () => {
  if (!HAS_DB || !orgId) return;
  await withService((tx) => tx.delete(organizations).where(eq(organizations.id, orgId)));
});

describe.skipIf(!HAS_DB)("contactMessagesNotIn", () => {
  it("does not hand back a message the run already has (no phantom new message)", async () => {
    await newConversation();
    const first = await add("contact", "hello");
    expect(await contactMessagesNotIn(orgId, conversationId, new Set([first]))).toEqual([]);
  });

  it("returns a contact message that arrived later, once, and ignores the agent's own replies", async () => {
    await newConversation();
    const known = new Set<string>();
    const first = await add("contact", "one");
    known.add(first);
    await add("assistant", "a reply");
    const later = await add("contact", "two");
    const fresh = await contactMessagesNotIn(orgId, conversationId, known);
    expect(fresh.map((m) => m.body)).toEqual(["two"]);
    known.add(later);
    expect(await contactMessagesNotIn(orgId, conversationId, known)).toEqual([]);
  });
});
