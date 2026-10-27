import "server-only";
import { and, desc, eq, inArray } from "drizzle-orm";
import { contacts, conversations, listOrgSecretKeys, meetings, organizations, orgProfiles, psaLinks, withService } from "@alevo/db";
import { displayName, fmtDateTime } from "@/lib/format";
import { CHANNEL_LABEL } from "@/lib/ui/status";
import {
  activitySummary,
  companyIdentifier,
  companyNameFor,
  connectwiseMissing,
  connectwiseSnapshot,
  CW_PROVIDER,
  LINK_KIND,
  opportunityName,
  splitName,
  type LeadSummary,
  type WritebackReason,
} from "./connectwise-map";
import { loadConnectWise } from "./connectwise";

/**
 * What a write-back needs to know about the lead. Built once per run (an
 * Inngest step) and passed to each `ensure*` below. Holds NO secrets: step
 * results are stored by Inngest, so the client is rebuilt inside every step.
 */
export type WritebackContext = {
  orgId: string;
  conversationId: string;
  contactId: string;
  contact: { name: string; firstName: string | null; lastName: string | null; email: string | null; phone: string | null; company: string | null };
  lead: LeadSummary;
};

/** Null when ConnectWise isn't connected for the org, or the conversation is gone. */
export async function loadWritebackContext(orgId: string, conversationId: string): Promise<WritebackContext | null> {
  const [[profile], setKeys] = await Promise.all([
    withService((tx) =>
      tx
        .select({
          connectwiseSite: orgProfiles.connectwiseSite,
          connectwiseCompanyId: orgProfiles.connectwiseCompanyId,
          connectwiseMember: orgProfiles.connectwiseMember,
          timezone: orgProfiles.timezone,
        })
        .from(orgProfiles)
        .where(eq(orgProfiles.orgId, orgId))
        .limit(1),
    ),
    listOrgSecretKeys(orgId),
  ]);
  const has = new Set(setKeys);
  if (connectwiseMissing(connectwiseSnapshot(profile), (k) => has.has(k)) !== null) return null;

  const [row] = await withService((tx) =>
    tx
      .select({
        contactId: conversations.contactId,
        channel: conversations.channel,
        fitScore: conversations.fitScore,
        scoreReasons: conversations.scoreReasons,
        firstName: contacts.firstName,
        lastName: contacts.lastName,
        email: contacts.email,
        phone: contacts.phone,
        company: contacts.company,
        orgName: organizations.name,
      })
      .from(conversations)
      .innerJoin(contacts, eq(contacts.id, conversations.contactId))
      .innerJoin(organizations, eq(organizations.id, conversations.orgId))
      .where(and(eq(conversations.id, conversationId), eq(conversations.orgId, orgId)))
      .limit(1),
  );
  if (!row) return null;

  const [meeting] = await withService((tx) =>
    tx
      .select({ startAt: meetings.startAt, joinUrl: meetings.joinUrl })
      .from(meetings)
      .where(and(eq(meetings.conversationId, conversationId), eq(meetings.orgId, orgId)))
      .orderBy(desc(meetings.createdAt))
      .limit(1),
  );

  const name = displayName(row.firstName, row.lastName, row.email ?? row.phone);
  const contact = { name, firstName: row.firstName, lastName: row.lastName, email: row.email, phone: row.phone, company: row.company };
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "");
  return {
    orgId,
    conversationId,
    contactId: row.contactId,
    contact,
    lead: {
      name,
      company: companyNameFor(contact),
      channel: CHANNEL_LABEL[row.channel],
      fitScore: row.fitScore,
      scoreReasons: row.scoreReasons,
      link: appUrl ? `${appUrl}/conversations/${conversationId}` : null,
      meeting: meeting ? { when: fmtDateTime(meeting.startAt, profile?.timezone ?? undefined), joinUrl: meeting.joinUrl } : null,
    },
  };
}

async function existingLink(orgId: string, kind: string, localId: string): Promise<number | null> {
  const [row] = await withService((tx) =>
    tx
      .select({ remoteId: psaLinks.remoteId })
      .from(psaLinks)
      .where(and(eq(psaLinks.orgId, orgId), eq(psaLinks.provider, CW_PROVIDER), eq(psaLinks.kind, kind), eq(psaLinks.localId, localId)))
      .limit(1),
  );
  return row ? Number(row.remoteId) : null;
}

async function saveLink(orgId: string, kind: string, localId: string, remoteId: number): Promise<void> {
  await withService((tx) =>
    tx.insert(psaLinks).values({ orgId, provider: CW_PROVIDER, kind, localId, remoteId: String(remoteId) }).onConflictDoNothing(),
  );
}

async function connection(orgId: string) {
  const loaded = await loadConnectWise(orgId);
  if (!loaded.ok) throw new Error(loaded.reason);
  return loaded.conn;
}

/**
 * Each `ensure*` is idempotent: the ledger first, then Manage's own search, and
 * only then a create — so a retried step never duplicates a record.
 */
export async function ensureCompany(ctx: WritebackContext): Promise<number> {
  const linked = await existingLink(ctx.orgId, LINK_KIND.company, ctx.contactId);
  if (linked) return linked;
  const { client } = await connection(ctx.orgId);
  const name = ctx.lead.company;
  const identifier = companyIdentifier(name);
  const id = (await client.findCompany(name, identifier)) ?? (await client.createCompany({ name, identifier }));
  await saveLink(ctx.orgId, LINK_KIND.company, ctx.contactId, id);
  return id;
}

export async function ensureContact(ctx: WritebackContext, companyId: number): Promise<number> {
  const linked = await existingLink(ctx.orgId, LINK_KIND.contact, ctx.contactId);
  if (linked) return linked;
  const { client } = await connection(ctx.orgId);
  const { email, phone } = ctx.contact;
  const found = email ? await client.findContactByEmail(email) : null;
  const id =
    found ??
    (await client.createContact({
      ...splitName(displayName(ctx.contact.firstName, ctx.contact.lastName, null), email),
      companyId,
      email,
      phone,
    }));
  await saveLink(ctx.orgId, LINK_KIND.contact, ctx.contactId, id);
  return id;
}

export async function ensureActivity(ctx: WritebackContext, reason: WritebackReason, companyId: number, contactId: number): Promise<number> {
  const kind = LINK_KIND.activity(reason);
  const linked = await existingLink(ctx.orgId, kind, ctx.conversationId);
  if (linked) return linked;
  const { client, member } = await connection(ctx.orgId);
  const { name, notes } = activitySummary(reason, ctx.lead);
  const id = await client.createActivity({ name, notes, companyId, contactId, member });
  await saveLink(ctx.orgId, kind, ctx.conversationId, id);
  return id;
}

export async function ensureOpportunity(ctx: WritebackContext, companyId: number, contactId: number): Promise<number> {
  const linked = await existingLink(ctx.orgId, LINK_KIND.opportunity, ctx.conversationId);
  if (linked) return linked;
  const { client, member } = await connection(ctx.orgId);
  const { notes } = activitySummary("booked", ctx.lead);
  const id = await client.createOpportunity({ name: opportunityName(ctx.lead), notes, companyId, contactId, member });
  await saveLink(ctx.orgId, LINK_KIND.opportunity, ctx.conversationId, id);
  return id;
}

export type LinkedRecord = { kind: string; remoteId: string; createdAt: Date };

/** What the PSA holds for a conversation (company + contact via the contact id). Tenant read. */
export async function linkedRecords(
  tx: Parameters<Parameters<typeof withService>[0]>[0],
  orgId: string,
  conversationId: string,
  contactId: string,
): Promise<LinkedRecord[]> {
  return tx
    .select({ kind: psaLinks.kind, remoteId: psaLinks.remoteId, createdAt: psaLinks.createdAt })
    .from(psaLinks)
    .where(and(eq(psaLinks.orgId, orgId), eq(psaLinks.provider, CW_PROVIDER), inArray(psaLinks.localId, [conversationId, contactId])))
    .orderBy(psaLinks.createdAt);
}
