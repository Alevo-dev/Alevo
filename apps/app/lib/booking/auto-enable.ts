import "server-only";
import { eq } from "drizzle-orm";
import { listOrgSecretKeys, orgProfiles, recordAudit, withService } from "@alevo/db";
import { bookingSnapshot, connectedBookingTools, newlyConnectedTool, type BookingTool } from "./connected";

async function read(orgId: string) {
  const [[row], keys] = await Promise.all([
    withService((tx) => tx.select().from(orgProfiles).where(eq(orgProfiles.orgId, orgId)).limit(1)),
    listOrgSecretKeys(orgId),
  ]);
  return { row, tools: connectedBookingTools(bookingSnapshot(row), (k) => keys.includes(k)).map((c) => c.tool) };
}

/** The booking tools connected right now. Call before saving a tool's settings, hand the result to `enableBookingOnConnect` after. */
export async function connectedToolsNow(orgId: string): Promise<ReadonlySet<BookingTool>> {
  return new Set((await read(orgId)).tools);
}

/**
 * Turn booking on (Agent → Booking) for a tool that has just become connected, when nothing is chosen
 * yet. Connecting is a deliberate act, so it also clears "Not using booking". Best-effort: the connection
 * itself is already saved, so a failure here must not fail it.
 */
export async function enableBookingOnConnect(orgId: string, before: ReadonlySet<BookingTool>, actorId: string | null = null): Promise<BookingTool | null> {
  try {
    const { row, tools } = await read(orgId);
    const tool = newlyConnectedTool(row?.bookingTool, before, tools);
    if (!tool) return null;
    await withService((tx) => tx.update(orgProfiles).set({ bookingTool: tool, bookingDeclined: false, updatedAt: new Date() }).where(eq(orgProfiles.orgId, orgId)));
    await recordAudit({ orgId, actorUserId: actorId, action: "booking.auto_enabled", target: tool });
    return tool;
  } catch {
    return null;
  }
}
