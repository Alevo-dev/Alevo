"use server";

import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { conversations, meetings, orgProfiles, type MeetingOutcome } from "@alevo/db";
import { getCurrentOrg, requireRole, withOrg } from "@alevo/auth";
import { bookingConfigFromProfile, getBookingAdapter } from "@/lib/booking";

export type ManageState = { ok?: boolean; error?: string };

const scoped = (id: string) =>
  and(eq(meetings.id, id), sql`${meetings.orgId} = (select app.current_org_id())`);

const OUTCOMES: MeetingOutcome[] = ["pending", "showed", "no_show"];

/** The org's booking adapter for cancel/reschedule (Cal.com / Google / M365). */
async function orgAdapter() {
  const org = await getCurrentOrg();
  if (!org) throw new Error("No active organization");
  const [p] = await withOrg((tx) =>
    tx
      .select()
      .from(orgProfiles)
      .where(sql`${orgProfiles.orgId} = (select app.current_org_id())`)
      .limit(1),
  );
  if (!p) return null;
  return getBookingAdapter(org.id, bookingConfigFromProfile(p));
}

/**
 * One action for all Meetings-tab mutations (rep+). `op` discriminates:
 * outcome / converted (local DB) and cancel / reschedule (call Cal.com first,
 * then sync our row). Scoped to the active org.
 */
export async function manageMeeting(_prev: ManageState, formData: FormData): Promise<ManageState> {
  try {
    await requireRole("rep");
    const op = String(formData.get("op") ?? "");
    const id = String(formData.get("id") ?? "");
    if (!id) return { error: "Missing meeting." };

    if (op === "outcome") {
      const outcome = String(formData.get("outcome") ?? "");
      if (!OUTCOMES.includes(outcome as MeetingOutcome)) return { error: "Invalid outcome." };
      await withOrg((tx) =>
        tx
          .update(meetings)
          .set({ outcome: outcome as MeetingOutcome, updatedAt: new Date() })
          .where(scoped(id)),
      );
    } else if (op === "converted") {
      const converted = String(formData.get("converted") ?? "") === "true";
      await withOrg((tx) =>
        tx.update(meetings).set({ converted, updatedAt: new Date() }).where(scoped(id)),
      );
    } else if (op === "cancel") {
      const [m] = await withOrg((tx) =>
        tx
          .select({ providerRef: meetings.providerRef, conversationId: meetings.conversationId })
          .from(meetings)
          .where(scoped(id))
          .limit(1),
      );
      if (!m) return { error: "Meeting not found." };
      if (m.providerRef) {
        const adapter = await orgAdapter();
        if (adapter) {
          const r = await adapter.cancel(m.providerRef, "Cancelled by the team");
          if (!r.ok) return { error: `Booking provider: ${r.error}` };
        }
      }
      await withOrg(async (tx) => {
        await tx.update(meetings).set({ status: "cancelled", updatedAt: new Date() }).where(scoped(id));
        if (m.conversationId) {
          await tx
            .update(conversations)
            .set({ status: "active", updatedAt: new Date() })
            .where(
              and(
                eq(conversations.id, m.conversationId),
                sql`${conversations.orgId} = (select app.current_org_id())`,
              ),
            );
        }
      });
    } else if (op === "reschedule") {
      const startIso = String(formData.get("start") ?? "");
      if (!startIso || Number.isNaN(Date.parse(startIso))) return { error: "Pick a new time." };
      const [m] = await withOrg((tx) =>
        tx.select({ providerRef: meetings.providerRef }).from(meetings).where(scoped(id)).limit(1),
      );
      if (!m?.providerRef) return { error: "Meeting not found." };
      const adapter = await orgAdapter();
      if (!adapter) return { error: "Booking isn't connected." };
      const r = await adapter.reschedule(m.providerRef, startIso, "Rescheduled by the team");
      if (!r.ok) return { error: `Booking provider: ${r.error}` };
      await withOrg((tx) =>
        tx
          .update(meetings)
          .set({
            status: "rescheduled",
            providerRef: r.uid,
            startAt: new Date(r.startIso),
            endAt: r.endIso ? new Date(r.endIso) : null,
            joinUrl: r.joinUrl,
            updatedAt: new Date(),
          })
          .where(scoped(id)),
      );
    } else {
      return { error: "Unknown operation." };
    }

    revalidatePath("/meetings");
    return { ok: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Something went wrong" };
  }
}
