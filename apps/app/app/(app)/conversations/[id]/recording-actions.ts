"use server";

import { and, eq } from "drizzle-orm";
import { calls } from "@alevo/db";
import { getCurrentOrg, requireRole, withOrg } from "@alevo/auth";
import { presignGetUrl } from "@/lib/r2";

export type RecordingResult = { url: string } | { error: string };

/** A short-lived link to a call's recording in R2. Admins and owners only; explicit org filter. */
export async function recordingUrl(callId: string): Promise<RecordingResult> {
  try {
    await requireRole("admin");
    const org = await getCurrentOrg();
    if (!org) return { error: "No active organization" };
    const [row] = await withOrg((tx) =>
      tx.select({ key: calls.recordingKey }).from(calls).where(and(eq(calls.id, callId), eq(calls.orgId, org.id))).limit(1),
    );
    if (!row?.key) return { error: "Recording unavailable" };
    return { url: await presignGetUrl(row.key, 600) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Recording unavailable" };
  }
}
