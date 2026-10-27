import { eq } from "drizzle-orm";
import * as Sentry from "@sentry/nextjs";
import { organizations, orgProfiles, withService } from "@alevo/db";
import { inngest, type VoiceCallEndedData } from "@/lib/inngest/client";
import { safeEqual } from "@/lib/crypto/safe-equal";
import { buildAssistantBody, VOICE_SECRET_HEADER } from "@/lib/voice/assistant";
import { ensureVoiceContact } from "@/lib/voice/contact";
import { bookingLinked, voiceModeNow } from "@/lib/voice/schedule";
import { dispatchVoiceTool, type VoiceToolContext } from "@/lib/voice/tools";
import { overAllowance } from "@/lib/usage/limits";

/**
 * Vapi server URL for inbound calls. Vapi sends `message.type` events here:
 *  - assistant-request: sent because the imported number carries our server URL and
 *    no fixed assistant; we answer with the assistant for this call (open, after hours, off)
 *  - tool-calls: run the agent's tools and return their results (required)
 *  - end-of-call-report: store the call, recording and summary (via Inngest)
 * Authenticated with the shared secret Vapi echoes back in `x-alevo-secret`.
 * The field names follow Vapi's documented payloads; confirm against a live call.
 */

type Payload = Record<string, unknown>;

function obj(v: unknown): Payload {
  return v && typeof v === "object" ? (v as Payload) : {};
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function authorized(req: Request): boolean {
  const expected = process.env.VOICE_WEBHOOK_SECRET;
  const got = req.headers.get(VOICE_SECRET_HEADER);
  return Boolean(expected && got) && safeEqual(got!, expected!);
}

/** Resolve the org from the number the caller dialled, or the assistant that answered. */
async function orgFor(phoneNumberId: string | null, assistantId: string | null) {
  if (!phoneNumberId && !assistantId) return null;
  const [row] = await withService((tx) =>
    tx
      .select({ profile: orgProfiles, orgName: organizations.name })
      .from(orgProfiles)
      .innerJoin(organizations, eq(organizations.id, orgProfiles.orgId))
      .where(
        phoneNumberId
          ? eq(orgProfiles.vapiPhoneNumberId, phoneNumberId)
          : eq(orgProfiles.vapiAssistantId, assistantId!),
      )
      .limit(1),
  );
  return row ?? null;
}

function parseArgs(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === "object") return raw as Record<string, unknown>;
  if (typeof raw === "string") {
    try {
      const parsed: unknown = JSON.parse(raw);
      return obj(parsed);
    } catch {
      return {};
    }
  }
  return {};
}

function secondsBetween(startIso: string | null, endIso: string | null): number | null {
  if (!startIso || !endIso) return null;
  const ms = Date.parse(endIso) - Date.parse(startIso);
  return Number.isFinite(ms) && ms >= 0 ? Math.round(ms / 1000) : null;
}

export async function POST(req: Request) {
  if (!authorized(req)) return new Response("Unauthorized", { status: 401 });

  const body = obj(await req.json().catch(() => null));
  const message = obj(body.message);
  const type = str(message.type) ?? "";
  const call = obj(message.call);
  const phoneNumberId = str(call.phoneNumberId) ?? str(obj(message.phoneNumber).id);
  const assistantId = str(call.assistantId);

  try {
    switch (type) {
      case "assistant-request": {
        const org = await orgFor(phoneNumberId, assistantId);
        const appUrl = process.env.NEXT_PUBLIC_APP_URL;
        const secret = process.env.VOICE_WEBHOOK_SECRET;
        // `error` is spoken to the caller, then Vapi ends the call.
        if (!org || !appUrl || !secret) {
          return Response.json({ error: "Sorry, this number isn't taking calls right now. Please text it instead." });
        }
        // Voice-minute allowance used up → calls pause until an upgrade (plan.md §6).
        if (await overAllowance(org.profile.orgId, "voice_minutes")) {
          return Response.json({ error: "Sorry, we can't take calls right now. Please text this number or email us and we'll get back to you." });
        }
        const assistant = buildAssistantBody({
          profile: org.profile,
          orgName: org.orgName,
          mode: voiceModeNow(org.profile),
          bookingConnected: bookingLinked(org.profile),
          appUrl,
          secret,
        });
        return Response.json({ assistant });
      }

      case "tool-calls": {
        const org = await orgFor(phoneNumberId, assistantId);
        const toolCalls = Array.isArray(message.toolCallList)
          ? message.toolCallList
          : Array.isArray(message.toolCalls)
            ? message.toolCalls
            : [];
        if (!org) return Response.json({ results: [] });

        const customer = str(obj(call.customer).number);
        if (!customer) {
          return Response.json({
            results: toolCalls.map((tc) => {
              const t = obj(tc);
              return {
                name: str(obj(t.function).name) ?? "",
                toolCallId: str(t.id) ?? "",
                result: "Couldn't link this call to a contact. Apologise and ask the caller to text this number.",
              };
            }),
          });
        }

        const link = await ensureVoiceContact(org.profile.orgId, customer);
        const ctx: VoiceToolContext = {
          orgId: org.profile.orgId,
          orgName: org.orgName,
          profile: org.profile,
          callRef: str(call.id) ?? "unknown",
          contactId: link.contactId,
          conversationId: link.conversationId,
        };

        const results = [];
        for (const tc of toolCalls) {
          const t = obj(tc);
          const fn = obj(t.function);
          const name = str(fn.name) ?? str(t.name) ?? "";
          const result = await dispatchVoiceTool(name, parseArgs(fn.arguments ?? t.arguments), ctx).catch((err) => {
            Sentry.captureException(err);
            return "Something went wrong. Apologise and take a message instead.";
          });
          results.push({ name, toolCallId: str(t.id) ?? "", result });
        }
        return Response.json({ results });
      }

      case "end-of-call-report": {
        const org = await orgFor(phoneNumberId, assistantId);
        const callRef = str(call.id);
        if (!org || !callRef) return new Response("ok (unmatched)", { status: 200 });

        const startedAt = str(call.startedAt) ?? str(message.startedAt);
        const endedAt = str(call.endedAt) ?? str(message.endedAt);
        const artifact = obj(message.artifact);
        const data: VoiceCallEndedData = {
          orgId: org.profile.orgId,
          callRef,
          endedReason: str(message.endedReason),
          startedAt,
          endedAt,
          durationSec:
            typeof message.durationSeconds === "number"
              ? Math.round(message.durationSeconds)
              : secondsBetween(startedAt, endedAt),
          // Newer reports carry the summary under `analysis`; older ones at the top level.
          summary: str(obj(message.analysis).summary) ?? str(message.summary),
          transcript: str(artifact.transcript) ?? str(message.transcript),
          customerNumber: str(obj(call.customer).number),
          toNumber: str(obj(call.phoneNumber).number) ?? str(obj(message.phoneNumber).number),
        };
        await inngest.send({ name: "voice/call.ended", data }).catch((err) => Sentry.captureException(err));
        return new Response("ok", { status: 200 });
      }

      default:
        return new Response("ok", { status: 200 });
    }
  } catch (err) {
    Sentry.captureException(err);
    return new Response("Processing error", { status: 500 });
  }
}
