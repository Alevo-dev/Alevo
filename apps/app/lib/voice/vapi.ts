import "server-only";
import { vendorFetch } from "@/lib/http/vendor-fetch";

/**
 * Vapi REST client (raw fetch, no SDK). The only importer of Vapi. Calls are
 * limited to the endpoints confirmed against the Vapi docs: assistant create /
 * update, phone-number import, and the call recording download.
 */
const BASE = "https://api.vapi.ai";

export function isVapiConfigured(): boolean {
  return Boolean(process.env.VAPI_API_KEY);
}

async function vapi(path: string, init: { method: string; body?: unknown }): Promise<Response> {
  const key = process.env.VAPI_API_KEY;
  if (!key) throw new Error("Vapi is not configured (VAPI_API_KEY)");
  return vendorFetch(`${BASE}${path}`, {
    method: init.method,
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
}

async function json<T>(res: Response, what: string): Promise<T> {
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Vapi ${what} failed (${res.status}): ${detail.slice(0, 300)}`);
  }
  return (await res.json()) as T;
}

/** Create an assistant. Returns its id. */
export async function createAssistant(body: Record<string, unknown>): Promise<{ id: string }> {
  return json(await vapi("/assistant", { method: "POST", body }), "create assistant");
}

/** Update an assistant with a partial body. */
export async function updateAssistant(id: string, body: Record<string, unknown>): Promise<void> {
  await json(await vapi(`/assistant/${encodeURIComponent(id)}`, { method: "PATCH", body }), "update assistant");
}

/**
 * Import an existing Twilio number. No assistant is attached: the number points
 * at our server URL instead, so Vapi sends `assistant-request` on every call and
 * the webhook answers with the assistant for the current mode (open, after hours,
 * or off). Returns the phone-number id.
 */
export async function importTwilioNumber(params: {
  number: string;
  name: string;
  serverUrl: string;
  secretHeader: string;
  secret: string;
}): Promise<{ id: string }> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) throw new Error("Twilio is not configured (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN)");
  return json(
    await vapi("/phone-number", {
      method: "POST",
      body: {
        provider: "twilio",
        number: params.number,
        twilioAccountSid: sid,
        twilioAuthToken: token,
        name: params.name,
        server: { url: params.serverUrl, headers: { [params.secretHeader]: params.secret } },
      },
    }),
    "import phone number",
  );
}

/**
 * Download a call's mono recording. Vapi answers with a redirect to a signed URL
 * that expires, so this follows it immediately and returns the bytes.
 */
export async function fetchCallRecording(callId: string): Promise<{ body: ArrayBuffer; contentType: string } | null> {
  const res = await vapi(`/call/${encodeURIComponent(callId)}/mono-recording`, { method: "GET" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Vapi recording fetch failed (${res.status})`);
  return {
    body: await res.arrayBuffer(),
    contentType: res.headers.get("content-type") ?? "audio/wav",
  };
}
