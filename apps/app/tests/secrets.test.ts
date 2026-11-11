import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { open, seal, signingKey } from "@alevo/db";
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

describe("key separation and versions", () => {
  const raw = () => Buffer.from(process.env.SECRETS_MASTER_KEY!, "base64");
  const sealWithRawMasterKey = (plaintext: string) => {
    const iv = randomBytes(12);
    const c = createCipheriv("aes-256-gcm", raw(), iv);
    const ciphertext = Buffer.concat([c.update(plaintext, "utf8"), c.final()]);
    return {
      ciphertext: ciphertext.toString("base64"),
      iv: iv.toString("base64"),
      authTag: c.getAuthTag().toString("base64"),
      keyVersion: 1,
    };
  };

  it("seals new secrets under a derived key, version 2", () => {
    const sealed = seal("fresh");
    expect(sealed.keyVersion).toBe(2);
    const d = createDecipheriv("aes-256-gcm", raw(), Buffer.from(sealed.iv, "base64"));
    d.setAuthTag(Buffer.from(sealed.authTag, "base64"));
    expect(() => Buffer.concat([d.update(Buffer.from(sealed.ciphertext, "base64")), d.final()])).toThrow();
  });

  it("still opens a version-1 secret sealed directly with the master key", () => {
    expect(open(sealWithRawMasterKey("legacy-value"))).toBe("legacy-value");
  });

  it("refuses a key version it does not know", () => {
    expect(() => open({ ...seal("x"), keyVersion: 99 })).toThrow(/key version/i);
  });

  it("derives a different 32-byte key per purpose, stable across calls, never the master key", () => {
    const a = signingKey("unsubscribe");
    expect(a).toHaveLength(32);
    expect(a.equals(signingKey("unsubscribe"))).toBe(true);
    expect(a.equals(signingKey("oauth-state"))).toBe(false);
    expect(a.equals(raw())).toBe(false);
  });
});
