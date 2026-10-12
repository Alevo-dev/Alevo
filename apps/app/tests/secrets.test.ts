import { describe, expect, it } from "vitest";
import { open, seal } from "@alevo/db";

/**
 * Pure crypto round-trip for per-org secrets. No DB needed. Requires
 * SECRETS_MASTER_KEY (loaded from .env.local in dev; set in CI env).
 */
describe("secret envelope encryption", () => {
  it("seals and opens back to the original plaintext", () => {
    const secret = "https://hooks.slack.com/services/T000/B000/xyz";
    const sealed = seal(secret);
    expect(sealed.ciphertext).not.toContain("hooks.slack.com");
    expect(open(sealed)).toBe(secret);
  });

  it("produces a unique IV per seal (same input ≠ same ciphertext)", () => {
    const a = seal("same-value");
    const b = seal("same-value");
    expect(a.iv).not.toBe(b.iv);
    expect(a.ciphertext).not.toBe(b.ciphertext);
    expect(open(a)).toBe(open(b));
  });

  it("rejects a tampered auth tag", () => {
    const sealed = seal("tamper-me");
    const bad = { ...sealed, ciphertext: Buffer.from("different").toString("base64") };
    expect(() => open(bad)).toThrow();
  });
});
