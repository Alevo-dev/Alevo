import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { vendorFetch } from "@/lib/http/vendor-fetch";

/**
 * Twilio SMS. Raw HTTP (no SDK). Platform credentials (TWILIO_ACCOUNT_SID /
 * TWILIO_AUTH_TOKEN); each org sends from its own number (org_profiles.sms_from_number),
 * which also routes inbound. Twilio enforces carrier-level STOP opt-out itself.
 */
export function isSmsConfigured(): boolean {
  return Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);
}

export type SmsResult = { ok: boolean; sid?: string; error?: string; optedOut?: boolean };

export async function sendSms(params: {
  fromNumber: string;
  toPhone: string;
  body: string;
}): Promise<SmsResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token || !params.fromNumber) return { ok: false, error: "sms-not-configured" };

  const auth = Buffer.from(`${sid}:${token}`).toString("base64");
  const form = new URLSearchParams({
    To: params.toPhone,
    From: params.fromNumber,
    Body: params.body,
  });
  try {
    const res = await vendorFetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: { authorization: `Basic ${auth}`, "content-type": "application/x-www-form-urlencoded" },
      body: form,
    });
    const json = (await res.json()) as { sid?: string; error_code?: number; message?: string };
    if (!res.ok) {
      // 21610 = recipient previously sent STOP. Not a hard failure — they opted out.
      return { ok: false, error: json.message ?? `twilio ${res.status}`, optedOut: json.error_code === 21610 };
    }
    return { ok: true, sid: json.sid };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "send-failed" };
  }
}

/**
 * Verify Twilio's `X-Twilio-Signature`: base64(HMAC-SHA1(authToken, url + each
 * POST param sorted by key as key+value)). `url` must be the exact public URL
 * Twilio requested (reconstruct from forwarded headers behind a proxy/tunnel).
 */
export function verifyTwilioSignature(
  url: string,
  params: Record<string, string>,
  signature: string | null,
): boolean {
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!token || !signature) return false;
  const data =
    url +
    Object.keys(params)
      .sort()
      .map((k) => k + params[k])
      .join("");
  const expected = createHmac("sha1", token).update(Buffer.from(data, "utf-8")).digest("base64");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Carrier opt-out keywords. Twilio intercepts these; we also stop engaging. */
const OPT_OUT = new Set(["stop", "stopall", "unsubscribe", "cancel", "end", "quit"]);
export function isOptOutMessage(body: string): boolean {
  return OPT_OUT.has(body.trim().toLowerCase());
}
