import "server-only";
import { and, desc, eq, inArray } from "drizzle-orm";
import {
  contacts,
  conversations,
  messages,
  orgProfiles,
  withService,
} from "@alevo/db";
import { loadQualifierContext, runQualifier, type QualifierResult } from "@/lib/qualifier/run";
import { DEFAULT_TIMEZONE } from "./send-window";
import { followupDirective } from "./schedule";

/** Statuses a lead can still be worked in — a cadence only nudges these. */
const WORKABLE: ReadonlySet<string> = new Set(["new", "active"]);

export type CadenceState =
  | { proceed: false; reason: string }
  | { proceed: true; timezone: string; startHour: number; endHour: number };

/**
 * Should the cadence send its next nudge? Re-checked right before each one, so a
 * lead that replied, got disqualified/handed off, or whose org turned the
 * Qualifier off is left alone. Also returns the send window to gate the nudge.
 */
export async function loadCadenceState(
  orgId: string,
  conversationId: string,
): Promise<CadenceState> {
  return withService(async (tx) => {
    const [conv] = await tx
      .select({ status: conversations.status, contactId: conversations.contactId })
      .from(conversations)
      .where(and(eq(conversations.id, conversationId), eq(conversations.orgId, orgId)))
      .limit(1);
    if (!conv) return { proceed: false, reason: "not-found" };
    if (!WORKABLE.has(conv.status)) return { proceed: false, reason: `status:${conv.status}` };

    const [profile] = await tx
      .select({
        enabled: orgProfiles.enabled,
        timezone: orgProfiles.timezone,
        startHour: orgProfiles.sendWindowStartHour,
        endHour: orgProfiles.sendWindowEndHour,
      })
      .from(orgProfiles)
      .where(eq(orgProfiles.orgId, orgId))
      .limit(1);
    if (!profile) return { proceed: false, reason: "no-profile" };
    if (!profile.enabled) return { proceed: false, reason: "disabled" };

    // If the newest message is the contact's, they replied — leave it to the
    // Qualifier (cancelOn should have torn us down already; this is a backstop).
    const [last] = await tx
      .select({ author: messages.author })
      .from(messages)
      .where(and(eq(messages.conversationId, conversationId), eq(messages.orgId, orgId)))
      .orderBy(desc(messages.createdAt))
      .limit(1);
    if (!last) return { proceed: false, reason: "no-messages" };
    if (last.author === "contact") return { proceed: false, reason: "contact-replied" };

    const [contact] = await tx
      .select({ timezone: contacts.timezone })
      .from(contacts)
      .where(and(eq(contacts.id, conv.contactId), eq(contacts.orgId, orgId)))
      .limit(1);

    return {
      proceed: true,
      timezone: contact?.timezone ?? profile.timezone ?? DEFAULT_TIMEZONE,
      startHour: profile.startHour,
      endHour: profile.endHour,
    };
  });
}

/**
 * Send one follow-up nudge through the Qualifier (reusing its reply/email
 * delivery). Not wrapped in step.run by the caller — like the main qualify run,
 * it writes a reply mid-run, so step memoization would replay the write.
 */
export async function runFollowup(
  orgId: string,
  conversationId: string,
  attempt: number,
  isLast: boolean,
): Promise<QualifierResult> {
  const ctx = await loadQualifierContext(orgId, conversationId);
  if (!ctx || "skip" in ctx) return { ran: false, skipped: "no-context" };
  return runQualifier(ctx, { directive: followupDirective(attempt, isLast) });
}

/**
 * Disqualify a lead that exhausted the cadence without ever replying — a
 * non-responsive prospect is treated as not a fit. Guarded to workable statuses
 * so a concurrent hand-off / disqualification / reply is never undone.
 */
export async function disqualifyStaleConversation(
  orgId: string,
  conversationId: string,
): Promise<void> {
  await withService((tx) =>
    tx
      .update(conversations)
      .set({ status: "disqualified", updatedAt: new Date() })
      .where(
        and(
          eq(conversations.id, conversationId),
          eq(conversations.orgId, orgId),
          inArray(conversations.status, ["new", "active"]),
        ),
      ),
  );
}
