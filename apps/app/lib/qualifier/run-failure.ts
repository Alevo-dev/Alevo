import "server-only";
import { and, eq } from "drizzle-orm";
import { conversations, replyOutcome, withService } from "@alevo/db";
import { isAnswered } from "./unanswered";
import { loadAnswerState } from "./watchdog";

/** What the team sees when the agent's run died before it could answer. */
export const RUN_FAILED_LABEL = "The agent hit an error";

/**
 * The agent's run threw. If the contact's latest message still has no reply, flag the
 * conversation so the team sees it on screen (the 5-minute watchdog alerts Slack
 * separately). Nothing is flagged when a reply already went out before the crash, and
 * the first-reply time stays unset: a crash is not an answer, so the wait keeps counting.
 */
export async function flagRunFailure(orgId: string, conversationId: string): Promise<boolean> {
  const state = await loadAnswerState(orgId, conversationId);
  if (!state || isAnswered(state.lastInbound, state.lastOutbound)) return false;
  await withService((tx) =>
    tx
      .update(conversations)
      .set(replyOutcome(RUN_FAILED_LABEL))
      .where(and(eq(conversations.id, conversationId), eq(conversations.orgId, orgId))),
  );
  return true;
}
