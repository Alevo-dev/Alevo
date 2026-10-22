import "server-only";
import { createHmac } from "node:crypto";
import { safeEqual } from "@/lib/crypto/safe-equal";

/**
 * Stateless, tamper-proof unsubscribe tokens: base64url(payload).hmac. Lets the
 * public unsubscribe endpoint identify the org + email with no session, while
 * preventing anyone from suppressing an address they can't already email.
 */
function secret(): string {
  const s = process.env.SECRETS_MASTER_KEY;
  if (!s) throw new Error("SECRETS_MASTER_KEY is not set");
  return s;
}

export function makeUnsubscribeToken(orgId: string, email: string): string {
  const payload = Buffer.from(JSON.stringify({ o: orgId, e: email.toLowerCase() })).toString(
    "base64url",
  );
  const sig = createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyUnsubscribeToken(token: string): { orgId: string; email: string } | null {
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = createHmac("sha256", secret()).update(payload).digest("base64url");
  if (!safeEqual(sig, expected)) return null;
  try {
    const obj = JSON.parse(Buffer.from(payload, "base64url").toString()) as { o?: string; e?: string };
    if (!obj.o || !obj.e) return null;
    return { orgId: obj.o, email: obj.e };
  } catch {
    return null;
  }
}
