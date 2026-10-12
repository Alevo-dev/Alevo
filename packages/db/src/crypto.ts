import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * AES-256-GCM envelope encryption for per-org secrets (plan.md rule 12).
 * The 32-byte master key lives in the app env (SECRETS_MASTER_KEY, base64),
 * never in the database. Rotate by minting a new key version and re-sealing.
 */

const CURRENT_KEY_VERSION = 1;

function masterKey(): Buffer {
  const b64 = process.env.SECRETS_MASTER_KEY;
  if (!b64) throw new Error("SECRETS_MASTER_KEY is not set");
  const key = Buffer.from(b64, "base64");
  if (key.length !== 32) {
    throw new Error("SECRETS_MASTER_KEY must decode to 32 bytes (generate with 32 random bytes, base64)");
  }
  return key;
}

export type SealedSecret = {
  ciphertext: string; // base64
  iv: string; // base64
  authTag: string; // base64
  keyVersion: number;
};

export function seal(plaintext: string): SealedSecret {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", masterKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
    keyVersion: CURRENT_KEY_VERSION,
  };
}

export function open(sealed: SealedSecret): string {
  const decipher = createDecipheriv("aes-256-gcm", masterKey(), Buffer.from(sealed.iv, "base64"));
  decipher.setAuthTag(Buffer.from(sealed.authTag, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(sealed.ciphertext, "base64")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}
