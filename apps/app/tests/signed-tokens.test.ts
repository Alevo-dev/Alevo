import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { signingKey } from "@alevo/db";
import { makeUnsubscribeToken, verifyUnsubscribeToken } from "@/lib/email/unsubscribe-token";
import { signState, verifyState } from "@/lib/booking/oauth";

const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");

describe("unsubscribe tokens", () => {
  it("round-trips org and (lower-cased) email", () => {
    const t = makeUnsubscribeToken("org-1", "Jane@Example.com");
    expect(verifyUnsubscribeToken(t)).toEqual({ orgId: "org-1", email: "jane@example.com" });
  });

  it("still accepts a link signed the old way, with the raw master key (already-sent emails)", () => {
    const payload = b64({ o: "org-1", e: "jane@example.com" });
    const sig = createHmac("sha256", process.env.SECRETS_MASTER_KEY!).update(payload).digest("base64url");
    expect(verifyUnsubscribeToken(`${payload}.${sig}`)).toEqual({ orgId: "org-1", email: "jane@example.com" });
  });

  it("rejects a tampered payload or a signature from another purpose", () => {
    const t = makeUnsubscribeToken("org-1", "jane@example.com");
    const [, sig] = t.split(".");
    expect(verifyUnsubscribeToken(`${b64({ o: "org-2", e: "jane@example.com" })}.${sig}`)).toBeNull();
  });
});

describe("calendar OAuth state", () => {
  it("round-trips", () => {
    expect(verifyState(signState("org-1", "google", "/workspace/integrations"))).toEqual({
      orgId: "org-1",
      provider: "google",
      returnTo: "/workspace/integrations",
    });
  });

  it("a signature made with the OAuth-state key is not an unsubscribe signature, even over a well-formed payload", () => {
    const payload = b64({ o: "org-1", e: "jane@example.com" });
    const sig = createHmac("sha256", signingKey("oauth-state")).update(payload).digest("base64url");
    expect(verifyUnsubscribeToken(`${payload}.${sig}`)).toBeNull();
  });
});
