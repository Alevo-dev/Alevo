import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyCalcomSignature, verifyCalendlySignature } from "@/lib/webhooks/booking-signature";

const raw = '{"triggerEvent":"BOOKING_CREATED","payload":{"uid":"abc"}}';
const secret = "whsec-test-secret";
const calSig = createHmac("sha256", secret).update(raw, "utf8").digest("hex");

describe("Cal.com webhook signature", () => {
  it("accepts a correctly signed body", () => {
    expect(verifyCalcomSignature(raw, secret, calSig)).toBe(true);
  });
  it("rejects a wrong or missing signature", () => {
    expect(verifyCalcomSignature(raw, secret, "deadbeef")).toBe(false);
    expect(verifyCalcomSignature(raw, secret, null)).toBe(false);
  });
  it("rejects everything when the org has no secret configured (fail closed)", () => {
    expect(verifyCalcomSignature(raw, null, calSig)).toBe(false);
    expect(verifyCalcomSignature(raw, "", calSig)).toBe(false);
  });
  it("rejects a body that was changed after signing", () => {
    expect(verifyCalcomSignature(raw.replace("abc", "xyz"), secret, calSig)).toBe(false);
  });
});

describe("Calendly webhook signature", () => {
  const sign = (t: number) => `t=${t},v1=${createHmac("sha256", secret).update(`${t}.${raw}`, "utf8").digest("hex")}`;
  const now = Math.floor(Date.now() / 1000);

  it("accepts a fresh, correctly signed body", () => {
    expect(verifyCalendlySignature(raw, secret, sign(now))).toBe(true);
  });
  it("rejects a stale delivery (replay older than five minutes)", () => {
    expect(verifyCalendlySignature(raw, secret, sign(now - 600))).toBe(false);
  });
  it("rejects a missing header or a wrong signature", () => {
    expect(verifyCalendlySignature(raw, secret, null)).toBe(false);
    expect(verifyCalendlySignature(raw, secret, `t=${now},v1=deadbeef`)).toBe(false);
  });
  it("rejects everything when the org has no secret configured (fail closed)", () => {
    expect(verifyCalendlySignature(raw, null, sign(now))).toBe(false);
  });
});
