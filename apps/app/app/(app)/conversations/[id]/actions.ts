"use server";

import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { conversations, messages } from "@alevo/db";
import { getCurrentOrg, withOrg } from "@alevo/auth";
import { inngest } from "@/lib/inngest/client";

export type ReplyState = {
  ok?: boolean;
  error?: string;
  errors?: { body?: string };
  /** Echoed back so the textarea keeps its text on error (rule 13). */
  value?: string;
};

/**
 * Test helper: post a message AS THE CONTACT, then fire the inbound-message
 * event so the Qualifier responds — exercising the full loop before the real
 * email/SMS channels exist. Tenant path (RLS), scoped to the active org.
 */
export async function replyAsContact(
  _prev: ReplyState,
  formData: FormData,
): Promise<ReplyState> {
  const conversationId = String(formData.get("conversationId") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return { errors: { body: "Type a message to send." }, value: body };

  try {
    const org = await getCurrentOrg();
    if (!org) return { error: "No active organization.", value: body };

    // Verify the conversation is in the active org and grab its channel.
    const [conv] = await withOrg((tx) =>
      tx
        .select({ channel: conversations.channel })
        .from(conversations)
        .where(
          and(
            eq(conversations.id, conversationId),
            sql`${conversations.orgId} = (select app.current_org_id())`,
          ),
        )
        .limit(1),
    );
    if (!conv) return { error: "Conversation not found.", value: body };

    await withOrg((tx) =>
      tx.insert(messages).values({
        orgId: org.id,
        conversationId,
        direction: "inbound",
        author: "contact",
        channel: conv.channel,
        body,
      }),
    );

    revalidatePath(`/conversations/${conversationId}`);

    // Side effect — a send failure must not lose the message just posted.
    try {
      await inngest.send({
        name: "conversation/message.received",
        data: { orgId: org.id, conversationId },
      });
    } catch {
      return { ok: true, error: "Message posted, but the Qualifier could not be notified." };
    }
    return { ok: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Something went wrong",
      value: body,
    };
  }
}
