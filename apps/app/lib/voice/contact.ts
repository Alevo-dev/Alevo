import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { contacts, conversations, withService } from "@alevo/db";

/**
 * Find or create the contact for a caller (by phone), and their open voice
 * conversation. A booked conversation is terminal, so a new call after a booking
 * opens a fresh one. Service path: the call has no session, so every write is
 * scoped to the org in code.
 */
export async function ensureVoiceContact(
  orgId: string,
  phone: string,
): Promise<{ contactId: string; conversationId: string }> {
  return withService(async (tx) => {
    const [existing] = await tx
      .select({ id: contacts.id })
      .from(contacts)
      .where(and(eq(contacts.orgId, orgId), eq(contacts.phone, phone)))
      .limit(1);
    let contactId = existing?.id;
    if (!contactId) {
      const [created] = await tx
        .insert(contacts)
        .values({ orgId, phone, source: "voice" })
        .returning({ id: contacts.id });
      contactId = created?.id;
    }
    if (!contactId) throw new Error("Failed to resolve contact");

    const [open] = await tx
      .select({ id: conversations.id })
      .from(conversations)
      .where(
        and(
          eq(conversations.orgId, orgId),
          eq(conversations.contactId, contactId),
          eq(conversations.channel, "voice"),
          sql`${conversations.status} not in ('closed','disqualified','booked')`,
        ),
      )
      .orderBy(desc(conversations.createdAt))
      .limit(1);

    let conversationId = open?.id;
    if (!conversationId) {
      const [created] = await tx
        .insert(conversations)
        .values({ orgId, contactId, channel: "voice", status: "new" })
        .returning({ id: conversations.id });
      conversationId = created?.id;
    }
    if (!conversationId) throw new Error("Failed to resolve conversation");
    return { contactId, conversationId };
  });
}
