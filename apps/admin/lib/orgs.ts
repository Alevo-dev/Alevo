import { and, eq, ilike, inArray, sql } from "drizzle-orm";
import {
  finishPage,
  keysetOrder,
  keysetWhere,
  memberships,
  orgProfiles,
  orgSubscriptions,
  organizations,
  PAGE_SIZE,
  plans,
  withService,
  type Cursor,
  type Page,
  type Tx,
} from "@alevo/db";

/**
 * Organization reads for the console. Cross-tenant by design (service path);
 * access is gated by the (admin) layout.
 */

const KEY = { at: organizations.createdAt, id: organizations.id };

/** Name, plan, agent switch and seat count: the columns every org table shows. */
function orgQuery(tx: Tx) {
  return tx
    .select({
      id: organizations.id,
      name: organizations.name,
      createdAt: organizations.createdAt,
      planName: plans.name,
      status: orgSubscriptions.status,
      agentOn: orgProfiles.enabled,
      // Seats: Alevo support members (migration 0030) are not counted.
      memberCount: sql<number>`count(distinct ${memberships.id}) filter (where not ${memberships.support})`.mapWith(Number),
    })
    .from(organizations)
    .leftJoin(memberships, eq(memberships.orgId, organizations.id))
    .leftJoin(orgSubscriptions, eq(orgSubscriptions.orgId, organizations.id))
    .leftJoin(plans, eq(plans.id, orgSubscriptions.planId))
    .leftJoin(orgProfiles, eq(orgProfiles.orgId, organizations.id))
    .groupBy(organizations.id, plans.name, orgSubscriptions.status, orgProfiles.enabled);
}

export type OrgRow = Awaited<ReturnType<typeof orgQuery>>[number];

/** `%` and `_` typed by the admin match themselves, not "anything". */
const nameLike = (q: string) => ilike(organizations.name, `%${q.replace(/[\\%_]/g, "\\$&")}%`);

/** One page of organizations, newest first; `q` keeps the names that contain it. */
export function orgsPage(cursor: Cursor | null, q = ""): Promise<Page<OrgRow>> {
  return withService((tx) =>
    orgQuery(tx)
      .where(and(keysetWhere(organizations, KEY, cursor), q ? nameLike(q) : undefined))
      .orderBy(...keysetOrder(KEY, cursor))
      .limit(PAGE_SIZE + 1),
  ).then((rows) => finishPage(rows, cursor));
}

/** Details for a known set of orgs (the funnel's busiest), in no particular order. */
export async function orgsById(ids: string[]): Promise<OrgRow[]> {
  if (ids.length === 0) return [];
  return withService((tx) => orgQuery(tx).where(inArray(organizations.id, ids)));
}

/** How many tenants exist and how many have the agent switched on. */
export async function orgCounts(): Promise<{ total: number; live: number }> {
  const [row] = await withService((tx) =>
    tx
      .select({
        total: sql<number>`count(*)`.mapWith(Number),
        live: sql<number>`count(*) filter (where ${orgProfiles.enabled})`.mapWith(Number),
      })
      .from(organizations)
      .leftJoin(orgProfiles, eq(orgProfiles.orgId, organizations.id)),
  );
  return row ?? { total: 0, live: 0 };
}

/** How many organizations a name search matches, and how many were created in the last `days` days. */
export async function orgTotals(q: string, days: number): Promise<{ matching: number; recent: number }> {
  const [row] = await withService((tx) =>
    tx
      .select({
        matching: sql<number>`count(*) filter (where ${q ? nameLike(q) : sql`true`})`.mapWith(Number),
        recent: sql<number>`count(*) filter (where ${organizations.createdAt} >= now() - (${days}::int * interval '1 day'))`.mapWith(Number),
      })
      .from(organizations),
  );
  return row ?? { matching: 0, recent: 0 };
}
