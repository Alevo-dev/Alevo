import { and, eq, isNull, sql } from "drizzle-orm";
import { conversations } from "./schema/conversations";
import { withService } from "./with-tenant";

/** Why the agent could not work a lead (see migration 0039). */
export type AgentSkipReason = "disabled" | "over-allowance" | "suppressed";

/**
 * Record that the agent could not work this lead. The first reason sticks, so a
 * later retry can't rewrite it. Scoped to the org: the service path bypasses RLS.
 */
export async function markAgentSkipped(orgId: string, conversationId: string, reason: AgentSkipReason): Promise<void> {
  await withService((tx) =>
    tx
      .update(conversations)
      .set({ agentSkipped: reason })
      .where(and(eq(conversations.id, conversationId), eq(conversations.orgId, orgId), isNull(conversations.agentSkipped))),
  );
}

/** Speed to lead counts a lead unless the agent could not work it. Shared by every speed query. */
export const countsTowardSpeed = sql`${conversations.agentSkipped} is null`;

/**
 * Columns to set when a reply attempt ends: the failure label, or null to clear a
 * failure left by an earlier attempt. The first-reply time is stamped either way,
 * so a failed delivery stops the clock at the moment the agent tried.
 */
export function replyOutcome(failure: string | null) {
  return { replyFailedAt: failure ? sql`now()` : null, replyError: failure };
}
