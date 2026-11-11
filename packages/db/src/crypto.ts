import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

/**
 * AES-256-GCM envelope encryption for per-org secrets (plan.md rule 12).
 * The 32-byte master key lives in the app env (SECRETS_MASTER_KEY, base64),
 * never in the database.
 *
 * The master key is never used directly for new work: each purpose gets its own
 * key derived with HKDF-SHA256, so a leak or misuse in one place (a token
 * signature, say) says nothing about the others.
 *
 * Key versions, stored with every sealed secret:
 *   1  the master key itself (how secrets were first written; still opened)
 *   2  HKDF(master, "alevo:secrets")  (every new seal)
 * To rotate, add version 3 here and re-seal; `open` picks the key by version.
 */

/** The version every new seal uses. */
export const currentKeyVersion = 2;

function masterKey(): Buffer {
  const b64 = process.env.SECRETS_MASTER_KEY;
  if (!b64) throw new Error("SECRETS_MASTER_KEY is not set");
  const key = Buffer.from(b64, "base64");
  if (key.length !== 32) {
    throw new Error("SECRETS_MASTER_KEY must decode to 32 bytes (generate with 32 random bytes, base64)");
  }
  return key;
}

/** A 32-byte key for one purpose ("unsubscribe", "oauth-state", ...), derived from the master key. Stable across calls. */
export function signingKey(purpose: string): Buffer {
  return Buffer.from(hkdfSync("sha256", masterKey(), Buffer.alloc(0), `alevo:${purpose}`, 32));
}

function keyFor(version: number): Buffer {
  if (version === 1) return masterKey();
  if (version === 2) return signingKey("secrets");
  throw new Error(`Unknown secret key version ${version}`);
}

export type SealedSecret = {
  ciphertext: string; // base64
  iv: string; // base64
  authTag: string; // base64
  keyVersion: number;
};

export function seal(plaintext: string): SealedSecret {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyFor(currentKeyVersion), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
    keyVersion: currentKeyVersion,
  };
}

export function open(sealed: SealedSecret): string {
  const decipher = createDecipheriv("aes-256-gcm", keyFor(sealed.keyVersion), Buffer.from(sealed.iv, "base64"));
  decipher.setAuthTag(Buffer.from(sealed.authTag, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(sealed.ciphertext, "base64")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}
