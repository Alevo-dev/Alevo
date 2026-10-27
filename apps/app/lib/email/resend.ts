import "server-only";
import { Resend } from "resend";
import { makeUnsubscribeToken } from "./unsubscribe-token";

/**
 * The email channel, backed by Resend. Outbound: the Qualifier emails leads from
 * a single Alevo-verified sending address (per-tenant sending domains come
 * later). Inbound: replies thread back to a per-conversation Reply-To
 * (`reply+<conversationId>@<INBOUND_EMAIL_DOMAIN>`) that we parse in the webhook.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function env() {
  return {
    apiKey: process.env.RESEND_API_KEY,
    from: process.env.EMAIL_FROM_ADDRESS,
    inboundDomain: process.env.INBOUND_EMAIL_DOMAIN,
  };
}

/** Email is live only when the key + both addresses are configured. */
export function isEmailConfigured(): boolean {
  const { apiKey, from, inboundDomain } = env();
  return Boolean(apiKey && from && inboundDomain);
}

let client: Resend | null = null;
function resend(): Resend {
  const { apiKey } = env();
  if (!apiKey) throw new Error("RESEND_API_KEY is not set");
  client ??= new Resend(apiKey);
  return client;
}

/** The per-conversation Reply-To address that routes a reply back to us. */
export function replyToAddress(conversationId: string): string {
  return `reply+${conversationId}@${env().inboundDomain}`;
}

/**
 * Format `name <email>` with the display name quoted — mail clients show the
 * name, so the contact sees "Acme IT" rather than the raw routing address.
 */
function formatAddress(name: string, email: string): string {
  const display = name.replace(/["\\]/g, "").trim();
  return display ? `"${display}" <${email}>` : email;
}

/** Pull a conversation id out of a `reply+<uuid>@domain` address, if present. */
export function parseConversationId(address: string): string | null {
  // Tolerate a `"Name" <addr>` form by extracting the angle-bracketed address.
  const bracket = address.match(/<([^>]+)>/);
  const addr = (bracket?.[1] ?? address).trim().toLowerCase();
  const local = addr.split("@")[0] ?? "";
  const plus = local.indexOf("+");
  if (plus === -1) return null;
  const id = local.slice(plus + 1);
  return UUID_RE.test(id) ? id : null;
}

/** First conversation id found across a set of recipient addresses. */
export function findConversationId(addresses: (string | null | undefined)[]): string | null {
  for (const a of addresses) {
    if (!a) continue;
    const id = parseConversationId(a);
    if (id) return id;
  }
  return null;
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Render a plain-text reply as simple, safe HTML (paragraphs preserved). */
function toHtml(body: string): string {
  return body
    .split(/\n{2,}/)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br/>")}</p>`)
    .join("\n");
}

export type SendResult = { ok: boolean; id?: string; error?: string };

/**
 * Send a Qualifier reply to a lead. From a single verified Alevo address with
 * the org's name as the display name; Reply-To routes responses back to this
 * conversation. In-Reply-To/References thread the message in the lead's client.
 */
export async function sendQualifierEmail(params: {
  orgId: string;
  orgName: string;
  toEmail: string;
  conversationId: string;
  subject: string;
  body: string;
  inReplyTo?: string | null;
  /** The org's postal address (Workspace → Business profile). CAN-SPAM / CASL want it in every footer. */
  businessAddress?: string | null;
}): Promise<SendResult> {
  const { from } = env();
  if (!isEmailConfigured() || !from) return { ok: false, error: "email-not-configured" };

  const headers: Record<string, string> = {};
  if (params.inReplyTo) {
    headers["In-Reply-To"] = params.inReplyTo;
    headers["References"] = params.inReplyTo;
  }
  // One-click unsubscribe (RFC 8058) header + a visible footer link. Mail clients
  // surface the header inconsistently, so we always render the link in the body too.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "");
  const unsubscribeUrl = appUrl
    ? `${appUrl}/api/unsubscribe?t=${makeUnsubscribeToken(params.orgId, params.toEmail)}`
    : null;
  if (unsubscribeUrl) {
    headers["List-Unsubscribe"] = `<${unsubscribeUrl}>`;
    headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
  }
  const footer = emailFooter({ orgName: params.orgName, businessAddress: params.businessAddress, unsubscribeUrl });
  const text = `${params.body}\n\n—\n${footer.text}`;
  const html = `${toHtml(params.body)}\n${footer.html}`;

  try {
    const { data, error } = await resend().emails.send({
      from: formatAddress(params.orgName, from),
      to: params.toEmail,
      replyTo: formatAddress(params.orgName, replyToAddress(params.conversationId)),
      subject: params.subject,
      text,
      html,
      headers,
      // Carried back on delivery events so bounce/complaint webhooks resolve the org.
      tags: [
        { name: "org_id", value: params.orgId },
        { name: "conversation_id", value: params.conversationId },
      ],
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, id: data?.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "send-failed" };
  }
}

/**
 * Footer on every agent email: who sent it and from where (CAN-SPAM / CASL), how
 * to stop (unsubscribe), and how to get a copy of or delete their data (GDPR /
 * PIPEDA). The address line is omitted until the org enters one.
 */
function emailFooter(p: { orgName: string; businessAddress?: string | null; unsubscribeUrl: string | null }) {
  const sender = [p.orgName, p.businessAddress?.trim()].filter(Boolean).join(" · ");
  const privacyUrl = "https://getalevo.com/privacy";
  const textLines = [
    `Sent by ${sender}`,
    p.unsubscribeUrl ? `Don't want these emails? Unsubscribe: ${p.unsubscribeUrl}` : null,
    `Reply to this email to request a copy or deletion of your data. Privacy: ${privacyUrl}`,
  ].filter(Boolean);
  const htmlLines = [
    `Sent by ${escapeHtml(sender)}`,
    p.unsubscribeUrl ? `Don't want these emails? <a href="${p.unsubscribeUrl}">Unsubscribe</a>.` : null,
    `Reply to this email to request a copy or deletion of your data. <a href="${privacyUrl}">Privacy policy</a>.`,
  ].filter(Boolean);
  return {
    text: textLines.join("\n"),
    html: `<p style="color:#888;font-size:12px;line-height:1.6;margin-top:16px">${htmlLines.join("<br>")}</p>`,
  };
}

/**
 * A plain transactional email from Alevo itself to a workspace member (usage
 * alerts, billing notices). Not a marketing email: no unsubscribe footer. Sent
 * from the same verified address with "Alevo" as the display name.
 */
export async function sendPlatformEmail(params: { to: string[]; subject: string; body: string }): Promise<SendResult> {
  const { from } = env();
  if (!isEmailConfigured() || !from || params.to.length === 0) return { ok: false, error: "email-not-configured" };
  try {
    const { data, error } = await resend().emails.send({
      from: formatAddress("Alevo", from),
      to: params.to,
      subject: params.subject,
      text: params.body,
      html: toHtml(params.body),
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, id: data?.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "send-failed" };
  }
}

export type ReceivedEmail = {
  from: string | null;
  subject: string | null;
  text: string | null;
  html: string | null;
};

/**
 * Fetch a received email's full content — the `email.received` webhook carries
 * metadata only, so the body is retrieved by id.
 */
export async function fetchReceivedEmail(emailId: string): Promise<ReceivedEmail | null> {
  try {
    const { data, error } = await resend().emails.receiving.get(emailId);
    if (error || !data) return null;
    return {
      from: data.from ?? null,
      subject: data.subject ?? null,
      text: data.text ?? null,
      html: data.html ?? null,
    };
  } catch {
    return null;
  }
}
