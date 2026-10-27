import { createHash } from "node:crypto";

/**
 * Spam checks for the public lead form, pure so they can be unit-tested.
 * Bots fail quietly: the caller returns a normal "thanks" and drops the lead,
 * so nothing teaches them which check they tripped.
 */

/** A bot that fills every field fills this one too. Humans never see it. */
export const HONEYPOT_FIELD = "website";
/** Humans don't complete a five-field form this fast. */
export const MIN_FILL_MS = 2_000;
/** A started-at older than this is a stale page, not a bot: let it through. */
const MAX_FILL_MS = 24 * 60 * 60 * 1000;

export type SpamReason = "honeypot" | "too_fast";

export function spamReason(input: { honeypot: string; startedAt: number | null; now: number }): SpamReason | null {
  if (input.honeypot.trim() !== "") return "honeypot";
  if (input.startedAt != null) {
    const elapsed = input.now - input.startedAt;
    if (elapsed >= 0 && elapsed < MIN_FILL_MS) return "too_fast";
  }
  return null;
}

/** Parse the hidden started-at field: a millisecond timestamp, or null when missing or implausible. */
export function parseStartedAt(raw: string, now: number): number | null {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (now - n > MAX_FILL_MS) return null;
  return n;
}

/** The caller's IP from the proxy headers (Vercel sets x-forwarded-for; the first hop is the client). */
export function clientIp(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for");
  const first = fwd?.split(",")[0]?.trim();
  return first || headers.get("x-real-ip") || "unknown";
}

/** Rate-limit keys never store a raw IP. */
export function ipKey(scope: string, ip: string): string {
  return `${scope}:ip:${createHash("sha256").update(ip).digest("hex").slice(0, 32)}`;
}

/** Per-IP: a burst brake. Per-org: a brake on a flood aimed at one customer's form. */
export const FORM_LIMITS = {
  ip: { limit: 10, windowSeconds: 10 * 60 },
  org: { limit: 300, windowSeconds: 60 * 60 },
} as const;
