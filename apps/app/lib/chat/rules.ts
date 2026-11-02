import { createHash, randomBytes } from "node:crypto";

/**
 * The pure parts of the website chat: limits, message hygiene, the visitor
 * token and the presence rule. No DB, no framework (`tests/chat.test.ts`).
 */

export const MAX_MESSAGE_CHARS = 2000;
export const MAX_GREETING_CHARS = 200;
export const MAX_AGENT_NAME_CHARS = 40;
export const DEFAULT_GREETING = "Hi! How can we help today?";
/** Alevo blue; the admin can pick another under Integrations → Chat widget. */
export const DEFAULT_ACCENT = "#2e9be6";
/** Shown under the composer and stored verbatim on the chat consent record. */
export const CHAT_CONSENT_TEXT = "By chatting with us you agree to be contacted about your inquiry.";

/** Per-IP: a burst brake on messages and on new sessions. Per-org: a brake on a flood aimed at one customer's site. */
export const CHAT_LIMITS = {
  message: { limit: 60, windowSeconds: 10 * 60 },
  start: { limit: 10, windowSeconds: 10 * 60 },
  org: { limit: 2000, windowSeconds: 60 * 60 },
} as const;

/** How long after their last poll the visitor still counts as "on the page". */
export const PRESENCE_MS = 2 * 60 * 1000;

/** Open CORS: the widget runs on the customer's site. The token travels as a bearer header. */
export const CHAT_CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type, authorization",
  "access-control-max-age": "86400",
} as const;

/** Trim, cap, and drop the empty. Line breaks are kept (people write lists). */
export function cleanMessage(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const text = raw
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
  if (!text) return null;
  return text.length > MAX_MESSAGE_CHARS ? text.slice(0, MAX_MESSAGE_CHARS) : text;
}

export function isHexColor(value: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(value);
}

/** The visitor's bearer token from the request, if any. */
export function bearerToken(headers: Headers): string | null {
  const auth = headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  return token.length >= 20 && token.length <= 128 && /^[A-Za-z0-9_-]+$/.test(token) ? token : null;
}

/** 192 random bits, URL-safe. The browser keeps it; only the hash is stored. */
export function newToken(): string {
  return randomBytes(24).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** A visitor whose widget polled recently is still reading; otherwise replies should reach them another way. */
export function visitorPresent(lastSeenAt: Date | null, now: number): boolean {
  return lastSeenAt != null && now - lastSeenAt.getTime() < PRESENCE_MS;
}
