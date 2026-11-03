import { and, count, eq, sql } from "drizzle-orm";
import {
  contacts,
  finishPage,
  keysetOrder,
  keysetWhere,
  PAGE_SIZE,
  type Channel,
  type ConversationStatus,
  type Cursor,
  type Page,
  type Tx,
} from "@alevo/db";

/**
 * The Conversations page, organised by client: one row per contact, most recent
 * activity first. Every query takes the org id explicitly (platform admins bypass
 * RLS) and a transaction, so the same code runs under `withOrg` on the page and
 * under `withService` in tests.
 */

export type ClientRow = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  /** Distinct channels the client has used, in enum order. */
  channels: Channel[];
  /** Status of the most recently updated conversation, null when there is none. */
  latestStatus: ConversationStatus | null;
  /** Highest fit score across their conversations. */
  maxFit: number | null;
  /** Conversations still being worked (new / active). */
  openCount: number;
  lastActivityAt: Date;
};

const KEY = { at: contacts.lastActivityAt, id: contacts.id };
const CHANNEL_ORDER: Channel[] = ["form", "email", "sms", "chat", "voice"];

const toChannels = (v: unknown): Channel[] => {
  const set = new Set(String(v ?? "").split(",").filter(Boolean));
  return CHANNEL_ORDER.filter((c) => set.has(c));
};
const toNullableNumber = (v: unknown) => (v == null ? null : Number(v));

/** One page of clients (PAGE_SIZE + 1 rows fetched; `finishPage` trims and builds the cursors). */
export async function clientsPage(tx: Tx, orgId: string, cursor: Cursor | null): Promise<Page<ClientRow>> {
  // Per-row aggregates as correlated subqueries over this contact's conversations only.
  const mine = sql`c.contact_id = ${contacts.id} and c.org_id = ${orgId}`;
  const rows = await tx
    .select({
      id: contacts.id,
      firstName: contacts.firstName,
      lastName: contacts.lastName,
      email: contacts.email,
      phone: contacts.phone,
      company: contacts.company,
      lastActivityAt: contacts.lastActivityAt,
      // coalesce: Drizzle skips the mapper for SQL nulls, and a client with no conversations must read as [].
      channels: sql<string>`coalesce((select string_agg(distinct c.channel::text, ',') from conversations c where ${mine}), '')`.mapWith(toChannels),
      latestStatus: sql<ConversationStatus | null>`(select c.status::text from conversations c where ${mine} order by c.updated_at desc, c.id desc limit 1)`,
      maxFit: sql<number | null>`(select max(c.fit_score) from conversations c where ${mine})`.mapWith(toNullableNumber),
      openCount: sql<number>`(select count(*) from conversations c where ${mine} and c.status in ('new','active'))`.mapWith(Number),
    })
    .from(contacts)
    .where(and(eq(contacts.orgId, orgId), keysetWhere(contacts, KEY, cursor)))
    .orderBy(...keysetOrder(KEY, cursor))
    .limit(PAGE_SIZE + 1);
  return finishPage(rows, cursor);
}

/** The header count. */
export async function clientCount(tx: Tx, orgId: string): Promise<number> {
  const [row] = await tx.select({ total: count() }).from(contacts).where(eq(contacts.orgId, orgId));
  return row?.total ?? 0;
}
