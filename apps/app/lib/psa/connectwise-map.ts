/**
 * ConnectWise Manage write-back: the pure half. Connection state from stored
 * settings, request plumbing (base URL, auth header, condition quoting) and the
 * mapping from an Alevo lead to PSA records. No I/O, so `tests/connectwise.test.ts`
 * covers it. The I/O half is `connectwise.ts`; the orchestration is `writeback.ts`.
 */

export const CW_PROVIDER = "connectwise";
export const CW_SECRET_KEYS = ["connectwise_public_key", "connectwise_private_key"] as const;

/** What the org typed in: the API host, its login company id, the API member. */
export type ConnectWiseSnapshot = { site: string | null; companyId: string | null; member: string | null };

type ProfileLike = Partial<{ connectwiseSite: string | null; connectwiseCompanyId: string | null; connectwiseMember: string | null }>;

export function connectwiseSnapshot(row: ProfileLike | undefined): ConnectWiseSnapshot {
  return {
    site: row?.connectwiseSite ?? null,
    companyId: row?.connectwiseCompanyId ?? null,
    member: row?.connectwiseMember ?? null,
  };
}

const HOST = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;

/**
 * "https://api-na.myconnectwise.net/v4_6_release/..." → "api-na.myconnectwise.net".
 * Null when what's left isn't a hostname.
 */
export function normalizeSite(input: string): string | null {
  const host = input
    .trim()
    .toLowerCase()
    .replace(/^[a-z]+:\/\//, "")
    .replace(/[/?#].*$/, "")
    .replace(/:\d+$/, "");
  return HOST.test(host) ? host : null;
}

type Has = (secretKey: string) => boolean;

/** What's still missing before the write-back can run; null when connected. */
export function connectwiseMissing(snap: ConnectWiseSnapshot, has: Has): string | null {
  const missing: string[] = [];
  if (!snap.site) missing.push("API site");
  if (!snap.companyId) missing.push("company ID");
  if (!snap.member) missing.push("member identifier");
  if (!has("connectwise_public_key")) missing.push("public key");
  if (!has("connectwise_private_key")) missing.push("private key");
  if (missing.length === 0) return null;
  if (missing.length === 1) return missing[0]!;
  return `${missing.slice(0, -1).join(", ")} and ${missing[missing.length - 1]}`;
}

/** Anything saved at all → the tool shows as a card (Needs setup until complete). */
export function connectwiseStarted(snap: ConnectWiseSnapshot, has: Has): boolean {
  return Boolean(snap.site || snap.companyId || snap.member) || CW_SECRET_KEYS.some(has);
}

/** REST base for a Manage instance (cloud regions and on-prem alike). */
export function cwBaseUrl(site: string): string {
  return `https://${site}/v4_6_release/apis/3.0`;
}

/** Manage's Basic auth: the login company id joined to the public key, then the private key. */
export function cwAuthorization(companyId: string, publicKey: string, privateKey: string): string {
  return `Basic ${Buffer.from(`${companyId}+${publicKey}:${privateKey}`, "utf8").toString("base64")}`;
}

/** A string literal for a `conditions=` query: double-quoted, quotes and backslashes escaped. */
export function cwQuote(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

/** Manage company identifiers: short, upper-case, letters and digits. */
export function companyIdentifier(name: string, maxLength = 25): string {
  const id = name
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9]+/g, "")
    .toUpperCase()
    .slice(0, maxLength);
  return id || "ALEVOLEAD";
}

/** "Ada Lovelace" → first / last; a lone word is the first name; nothing → the email's local part. */
export function splitName(fullName: string | null | undefined, email: string | null | undefined): { firstName: string; lastName: string } {
  const parts = (fullName ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    const local = (email ?? "").split("@")[0] ?? "";
    return { firstName: local || "Lead", lastName: "" };
  }
  return { firstName: parts[0]!, lastName: parts.slice(1).join(" ") };
}

/**
 * The company a contact belongs to in the PSA: what they told us, else their
 * email domain ("acme.com" → "acme.com"), else the person's own name.
 */
export function companyNameFor(contact: { company: string | null; email: string | null; name: string }): string {
  const typed = contact.company?.trim();
  if (typed) return typed;
  const domain = contact.email?.split("@")[1]?.toLowerCase();
  if (domain && !FREE_MAIL.has(domain)) return domain;
  return contact.name;
}

const FREE_MAIL = new Set(["gmail.com", "outlook.com", "hotmail.com", "yahoo.com", "icloud.com", "live.com", "proton.me", "protonmail.com", "aol.com"]);

/** Why a write-back runs. Only qualified leads reach the PSA (the dashboard's definition). */
export type WritebackReason = "handed_off" | "booked";
export const WRITEBACK_REASONS: readonly WritebackReason[] = ["handed_off", "booked"];

export function isWritebackReason(value: unknown): value is WritebackReason {
  return (WRITEBACK_REASONS as readonly unknown[]).includes(value);
}

/** psa_links.kind for each record. */
export const LINK_KIND = {
  company: "company",
  contact: "contact",
  opportunity: "opportunity",
  activity: (reason: WritebackReason) => `activity:${reason}` as const,
} as const;

export type LeadSummary = {
  name: string;
  company: string;
  channel: string;
  fitScore: number | null;
  scoreReasons: string | null;
  /** Deep link into Alevo, when the app URL is known. */
  link: string | null;
  meeting?: { when: string; joinUrl: string | null } | null;
};

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** The activity Manage shows on the company timeline: a 100-char name and the notes. */
export function activitySummary(reason: WritebackReason, lead: LeadSummary): { name: string; notes: string } {
  const head = reason === "booked" ? "Alevo booked a meeting" : "Alevo handed off a lead";
  const name = clip(`${head}: ${lead.name}`, 100);
  const lines = [
    reason === "booked"
      ? `Meeting booked by the Alevo agent${lead.meeting ? ` for ${lead.meeting.when}` : ""}.`
      : "The Alevo agent qualified this lead and handed it to a person.",
    `Channel: ${lead.channel}.`,
    lead.fitScore != null ? `Fit score: ${lead.fitScore}/100.` : null,
    lead.scoreReasons ? `Why: ${lead.scoreReasons}` : null,
    lead.meeting?.joinUrl ? `Join link: ${lead.meeting.joinUrl}` : null,
    lead.link ? `Conversation: ${lead.link}` : null,
  ];
  return { name, notes: lines.filter((l): l is string => Boolean(l)).join("\n") };
}

/** "Acme — inbound via Alevo (Ada Lovelace)", within Manage's 100 characters. */
export function opportunityName(lead: LeadSummary): string {
  return clip(`${lead.company} — inbound via Alevo (${lead.name})`, 100);
}
