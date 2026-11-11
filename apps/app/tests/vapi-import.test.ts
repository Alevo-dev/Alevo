import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { importTwilioNumber } from "@/lib/voice/vapi";

const EXISTING = "c0cdca7c-7311-4f6d-9a97-af24cff9b9dc";
const params = { number: "+18073025386", name: "Acme inbound", serverUrl: "https://x.test/v", secretHeader: "x-s", secret: "s" };

const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("importTwilioNumber", () => {
  const calls: { url: string; method?: string }[] = [];
  beforeEach(() => {
    calls.length = 0;
    vi.stubEnv("VAPI_API_KEY", "k");
    vi.stubEnv("TWILIO_ACCOUNT_SID", "ACx");
    vi.stubEnv("TWILIO_AUTH_TOKEN", "t");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  const stub = (...responses: Response[]) =>
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      calls.push({ url, method: init.method });
      return responses.shift()!;
    });

  it("adopts the Vapi number that already exists for this Twilio number and re-points it", async () => {
    stub(
      reply(400, { message: `Existing Phone Number ${EXISTING} Has Identical \`twilioAccountSid\` ACx and \`number\` +18073025386.`, statusCode: 400 }),
      reply(200, {}),
    );
    expect(await importTwilioNumber(params)).toEqual({ id: EXISTING });
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      "POST https://api.vapi.ai/phone-number",
      `PATCH https://api.vapi.ai/phone-number/${EXISTING}`,
    ]);
  });

  it("still fails on any other 400", async () => {
    stub(reply(400, { message: "Invalid number", statusCode: 400 }));
    await expect(importTwilioNumber(params)).rejects.toThrow(/import phone number failed \(400\)/);
  });
});
