import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { calls, conversations, recordConsent, withService } from "@alevo/db";
import { putObject } from "@/lib/r2";
import { meterUsage } from "@/lib/usage/limits";
import { notifyOrg } from "@/lib/notifications/notify";
import type { VoiceCallEndedData } from "@/lib/inngest/client";
import { fetchCallRecording, isVapiConfigured } from "./vapi";
import { callThread } from "./contact";

/** Fetch the recording from Vapi and store it in R2. Returns the object key, or null if none. */
export async function storeRecording(data: VoiceCallEndedData): Promise<string | null> {
  if (!isVapiConfigured() || !process.env.R2_BUCKET) return null;
  const recording = await fetchCallRecording(data.orgId, data.callRef);
  if (!recording) return null;
  const ext = recording.contentType.includes("mpeg") ? "mp3" : recording.contentType.includes("wav") ? "wav" : "bin";
  const key = `organizations/${data.orgId}/calls/${data.callRef}.${ext}`;
  await putObject(key, recording.body, recording.contentType);
  return key;
}

/**
 * Fill the call's row (opened by the first tool call, or here for a call with
 * none) with how it ended, meter the minutes, and alert the team. The thread
 * shows the call itself (summary, outcome, recording) — no summary message is
 * written. Idempotent per (org, call): a second report finds `ended_at` already
 * set and changes nothing. `summary` overrides the report's (the Claude fallback).
 */
export async function recordCall(data: VoiceCallEndedData, recordingKey: string | null, summary?: string | null) {
  const thread = await callThread(data.orgId, data.callRef, data.customerNumber);

  // Outcome comes from where the conversation ended up during the call.
  const [conv] = await withService((tx) =>
    tx
      .select({ status: conversations.status })
      .from(conversations)
      .where(and(eq(conversations.id, thread.conversationId), eq(conversations.orgId, data.orgId)))
      .limit(1),
  );
  const outcome: string =
    conv?.status === "booked" || conv?.status === "handed_off" || conv?.status === "disqualified" ? conv.status : "none";
  const text = (summary ?? data.summary)?.trim() || null;

  const updated = await withService((tx) =>
    tx
      .update(calls)
      .set({
        toNumber: data.toNumber,
        endedReason: data.endedReason,
        startedAt: data.startedAt ? new Date(data.startedAt) : undefined,
        endedAt: data.endedAt ? new Date(data.endedAt) : new Date(),
        durationSec: data.durationSec,
        summary: text,
        transcript: data.transcript,
        recordingKey,
        outcome,
      })
      .where(and(eq(calls.id, thread.callId), eq(calls.orgId, data.orgId), isNull(calls.endedAt)))
      .returning({ id: calls.id }),
  );
  if (updated.length === 0) return { ok: true, duplicate: true, needsSummary: false };

  const minutes = Math.max(1, Math.ceil((data.durationSec ?? 0) / 60));

  // Independent writes, run together: caller consent (voice channel, idempotent —
  // as for form, email and SMS), the minutes, and the alert.
  await Promise.all([
    recordConsent(data.orgId, thread.contactId, "voice", "inbound_call", { source: "voice" }).catch(() => {}),
    meterUsage(data.orgId, "voice_minutes", minutes),
    notifyOrg(data.orgId, `Call ended (${outcome.replace("_", " ")}, ${minutes} min). ${text ?? "No summary"}`).catch(() => {}),
  ]);

  return { ok: true, duplicate: false, outcome, recordingKey, needsSummary: text === null };
}

/** The Claude fallback's summary, written after the first report found none. */
export async function setCallSummary(orgId: string, callRef: string, summary: string): Promise<void> {
  const text = summary.trim();
  if (!text) return;
  await withService((tx) =>
    tx
      .update(calls)
      .set({ summary: text })
      .where(and(eq(calls.orgId, orgId), eq(calls.providerRef, callRef), isNull(calls.summary))),
  );
}
