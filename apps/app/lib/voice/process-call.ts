import "server-only";
import { eq, and } from "drizzle-orm";
import { calls, conversations, messages, recordConsent, recordUsage, withService } from "@alevo/db";
import { putObject } from "@/lib/r2";
import { notifySlack } from "@/lib/notifications/slack";
import type { VoiceCallEndedData } from "@/lib/inngest/client";
import { fetchCallRecording, isVapiConfigured } from "./vapi";
import { ensureVoiceContact } from "./contact";

/** Fetch the recording from Vapi and store it in R2. Returns the object key, or null if none. */
export async function storeRecording(data: VoiceCallEndedData): Promise<string | null> {
  if (!isVapiConfigured() || !process.env.R2_BUCKET) return null;
  const recording = await fetchCallRecording(data.callRef);
  if (!recording) return null;
  const ext = recording.contentType.includes("mpeg") ? "mp3" : recording.contentType.includes("wav") ? "wav" : "bin";
  const key = `organizations/${data.orgId}/calls/${data.callRef}.${ext}`;
  await putObject(key, recording.body, recording.contentType);
  return key;
}

/**
 * Write the call record and its summary into the contact's thread, meter the
 * minutes, and alert the team. Idempotent per (org, call): a repeated report
 * changes nothing and is not metered or alerted twice.
 */
export async function recordCall(data: VoiceCallEndedData, recordingKey: string | null) {
  const link = data.customerNumber ? await ensureVoiceContact(data.orgId, data.customerNumber) : null;

  // Outcome comes from where the conversation ended up during the call.
  let outcome: string = "none";
  if (link) {
    const [conv] = await withService((tx) =>
      tx
        .select({ status: conversations.status })
        .from(conversations)
        .where(and(eq(conversations.id, link.conversationId), eq(conversations.orgId, data.orgId)))
        .limit(1),
    );
    if (conv?.status === "booked") outcome = "booked";
    else if (conv?.status === "handed_off") outcome = "handed_off";
    else if (conv?.status === "disqualified") outcome = "disqualified";
  }

  const inserted = await withService((tx) =>
    tx
      .insert(calls)
      .values({
        orgId: data.orgId,
        contactId: link?.contactId ?? null,
        conversationId: link?.conversationId ?? null,
        providerRef: data.callRef,
        fromNumber: data.customerNumber,
        toNumber: data.toNumber,
        endedReason: data.endedReason,
        startedAt: data.startedAt ? new Date(data.startedAt) : null,
        endedAt: data.endedAt ? new Date(data.endedAt) : null,
        durationSec: data.durationSec,
        summary: data.summary,
        transcript: data.transcript,
        recordingKey,
        outcome,
      })
      .onConflictDoNothing()
      .returning({ id: calls.id }),
  );
  if (inserted.length === 0) return { ok: true, duplicate: true };

  const minutes = Math.max(1, Math.ceil((data.durationSec ?? 0) / 60));
  const summary = data.summary?.trim() || "No summary";

  // Independent writes, run together: the thread entry + caller consent (voice
  // channel, idempotent — as for form, email and SMS), the minutes, and the alert.
  await Promise.all([
    link &&
      withService((tx) =>
        tx.insert(messages).values({
          orgId: data.orgId,
          conversationId: link.conversationId,
          direction: "inbound",
          author: "contact",
          channel: "voice",
          body: data.summary?.trim() || "Call ended with no summary.",
          providerRef: `call:${data.callRef}`,
        }),
      ),
    link && recordConsent(data.orgId, link.contactId, "voice", "inbound_call", { source: "voice" }).catch(() => {}),
    recordUsage(data.orgId, "voice_minutes", minutes),
    notifySlack(data.orgId, `Call ended (${outcome.replace("_", " ")}, ${minutes} min). ${summary}`).catch(() => {}),
  ]);

  return { ok: true, duplicate: false, outcome, recordingKey };
}
