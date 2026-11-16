import { and, count, eq, ilike, or, sql, type SQL } from "drizzle-orm";
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
  /** IANA zone from the lead form's browser, when we have it. */
  timezone: string | null;
  /** Where the active consent came from (hosted_form, embed, api, …), newest first. */
  consentSource: string | null;
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

/** The Conversations tabs: everyone, or clients whose latest conversation is in a group of statuses. */
export const CLIENT_FILTERS = ["all", "open", "handed_off", "booked", "disqualified"] as const;
export type ClientFilter = (typeof CLIENT_FILTERS)[number];
const FILTER_STATUSES: Record<Exclude<ClientFilter, "all">, ConversationStatus[]> = {
  open: ["new", "active"],
  handed_off: ["handed_off"],
  booked: ["booked"],
  disqualified: ["disqualified"],
};

export function parseFilter(v: unknown): ClientFilter {
  return (CLIENT_FILTERS as readonly unknown[]).includes(v) ? (v as ClientFilter) : "all";
}

/** Status of the contact's most recently updated conversation (correlated subquery). */
const latestStatusSql = (orgId: string) =>
  sql`(select c.status::text from conversations c where c.contact_id = ${contacts.id} and c.org_id = ${orgId} order by c.updated_at desc, c.id desc limit 1)`;

/** The where clause for a tab and a search box (name, company, email or phone contains `q`). */
function listWhere(orgId: string, filter: ClientFilter, q: string): SQL | undefined {
  const parts: (SQL | undefined)[] = [eq(contacts.orgId, orgId)];
  if (filter !== "all") {
    parts.push(sql`${latestStatusSql(orgId)} in (${sql.join(FILTER_STATUSES[filter].map((v) => sql`${v}`), sql`, `)})`);
  }
  const term = q.trim().slice(0, 80).replace(/[\\%_]/g, "\\$&");
  if (term) {
    const like = `%${term}%`;
    parts.push(
      or(
        ilike(contacts.firstName, like),
        ilike(contacts.lastName, like),
        ilike(contacts.email, like),
        ilike(contacts.company, like),
        ilike(contacts.phone, like),
        sql`concat_ws(' ', ${contacts.firstName}, ${contacts.lastName}) ilike ${like}`,
      ),
    );
  }
  return and(...parts);
}

export type ClientListOpts = { filter?: ClientFilter; q?: string };

const KEY = { at: contacts.lastActivityAt, id: contacts.id };
export const EXPORT_CAP = 5000;
const CHANNEL_ORDER: Channel[] = ["form", "email", "sms", "chat", "voice"];

const toChannels = (v: unknown): Channel[] => {
  const set = new Set(String(v ?? "").split(",").filter(Boolean));
  return CHANNEL_ORDER.filter((c) => set.has(c));
};
const toNullableNumber = (v: unknown) => (v == null ? null : Number(v));

/** The columns of one client row (per-row aggregates as correlated subqueries over this contact's rows only). */
function rowColumns(orgId: string) {
  const mine = sql`c.contact_id = ${contacts.id} and c.org_id = ${orgId}`;
  return {
    id: contacts.id,
    firstName: contacts.firstName,
    lastName: contacts.lastName,
    email: contacts.email,
    phone: contacts.phone,
    company: contacts.company,
    timezone: contacts.timezone,
    consentSource: sql<string | null>`(select k.source from consents k where k.contact_id = ${contacts.id} and k.org_id = ${orgId} and k.revoked_at is null order by k.granted_at desc limit 1)`,
    lastActivityAt: contacts.lastActivityAt,
    // coalesce: Drizzle skips the mapper for SQL nulls, and a client with no conversations must read as [].
    channels: sql<string>`coalesce((select string_agg(distinct c.channel::text, ',') from conversations c where ${mine}), '')`.mapWith(toChannels),
    latestStatus: sql<ConversationStatus | null>`${latestStatusSql(orgId)}`,
    maxFit: sql<number | null>`(select max(c.fit_score) from conversations c where ${mine})`.mapWith(toNullableNumber),
    openCount: sql<number>`(select count(*) from conversations c where ${mine} and c.status in ('new','active'))`.mapWith(Number),
  };
}

/** One page of clients (PAGE_SIZE + 1 rows fetched; `finishPage` trims and builds the cursors). */
export async function clientsPage(tx: Tx, orgId: string, cursor: Cursor | null, opts: ClientListOpts = {}): Promise<Page<ClientRow>> {
  const rows = await tx
    .select(rowColumns(orgId))
    .from(contacts)
    .where(and(listWhere(orgId, opts.filter ?? "all", opts.q ?? ""), keysetWhere(contacts, KEY, cursor)))
    .orderBy(...keysetOrder(KEY, cursor))
    .limit(PAGE_SIZE + 1);
  return finishPage(rows, cursor);
}

/** The CSV export: the same rows as the list (tab + search), newest activity first, no paging, capped. */
export async function clientsForExport(tx: Tx, orgId: string, opts: ClientListOpts = {}, limit = EXPORT_CAP): Promise<ClientRow[]> {
  return tx
    .select(rowColumns(orgId))
    .from(contacts)
    .where(listWhere(orgId, opts.filter ?? "all", opts.q ?? ""))
    .orderBy(...keysetOrder(KEY, null))
    .limit(limit);
}

/** Clients matching the tab and search: the pager's total. */
export async function clientCount(tx: Tx, orgId: string, opts: ClientListOpts = {}): Promise<number> {
  const [row] = await tx.select({ total: count() }).from(contacts).where(listWhere(orgId, opts.filter ?? "all", opts.q ?? ""));
  return row?.total ?? 0;
}

/** The count on every tab, in one pass over the org's clients. */
export async function clientTabCounts(tx: Tx, orgId: string): Promise<Record<ClientFilter, number>> {
  const latest = latestStatusSql(orgId);
  const n = (statuses: ConversationStatus[]) =>
    sql<number>`count(*) filter (where ${latest} in (${sql.join(statuses.map((v) => sql`${v}`), sql`, `)}))`.mapWith(Number);
  const [row] = await tx
    .select({
      all: count(),
      open: n(FILTER_STATUSES.open),
      handed_off: n(FILTER_STATUSES.handed_off),
      booked: n(FILTER_STATUSES.booked),
      disqualified: n(FILTER_STATUSES.disqualified),
    })
    .from(contacts)
    .where(eq(contacts.orgId, orgId));
  return { all: row?.all ?? 0, open: row?.open ?? 0, handed_off: row?.handed_off ?? 0, booked: row?.booked ?? 0, disqualified: row?.disqualified ?? 0 };
}
