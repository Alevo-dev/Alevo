import { createHmac } from "node:crypto";
import { safeEqual } from "@/lib/crypto/safe-equal";

/**
 * Signature checks for the per-org booking webhooks (plan.md rule 7). Both
 * FAIL CLOSED: an org with no signing secret stored gets `false`, so a request
 * that merely names a real org and booking can never be accepted unsigned.
 */

/** Cal.com: `x-cal-signature-256` = hex HMAC-SHA256(secret, raw body). */
export function verifyCalcomSignature(raw: string, secret: string | null, signature: string | null): boolean {
  if (!secret || !signature) return false;
  return safeEqual(signature, createHmac("sha256", secret).update(raw, "utf8").digest("hex"));
}

/** Calendly: `t=<unix>,v1=<hex>`; v1 = HMAC-SHA256(secret, `t.rawBody`). Deliveries older than 5 minutes are replays. */
export function verifyCalendlySignature(raw: string, secret: string | null, header: string | null): boolean {
  if (!secret || !header) return false;
  const parts = Object.fromEntries(
    header.split(",").map((p) => {
      const [k, v] = p.split("=");
      return [k?.trim(), v?.trim()];
    }),
  );
  const t = parts.t;
  const v1 = parts.v1;
  if (!t || !v1) return false;
  const ts = Number(t);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 300) return false;
  return safeEqual(v1, createHmac("sha256", secret).update(`${t}.${raw}`, "utf8").digest("hex"));
}
