import "server-only";
import { and, asc, eq, notInArray } from "drizzle-orm";
import { messages, withService } from "@alevo/db";

/**
 * Contact messages this run has not seen yet (it already holds `known`). By id, not by timestamp: Postgres keeps
 * microseconds and a JS Date only milliseconds, so "newer than the last message" matched that message itself and the
 * agent answered it again and again.
 */
export async function contactMessagesNotIn(orgId: string, conversationId: string, known: Set<string>): Promise<{ id: string; body: string }[]> {
  return withService((tx) =>
    tx
      .select({ id: messages.id, body: messages.body })
      .from(messages)
      .where(
        and(
          eq(messages.conversationId, conversationId),
          eq(messages.orgId, orgId),
          eq(messages.author, "contact"),
          known.size > 0 ? notInArray(messages.id, [...known]) : undefined,
        ),
      )
      .orderBy(asc(messages.createdAt)),
  );
}
