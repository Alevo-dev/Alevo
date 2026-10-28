import { eq, inArray, sql } from "drizzle-orm";
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
      memberCount: sql<number>`count(distinct ${memberships.id})`.mapWith(Number),
    })
    .from(organizations)
    .leftJoin(memberships, eq(memberships.orgId, organizations.id))
    .leftJoin(orgSubscriptions, eq(orgSubscriptions.orgId, organizations.id))
    .leftJoin(plans, eq(plans.id, orgSubscriptions.planId))
    .leftJoin(orgProfiles, eq(orgProfiles.orgId, organizations.id))
    .groupBy(organizations.id, plans.name, orgSubscriptions.status, orgProfiles.enabled);
}

export type OrgRow = Awaited<ReturnType<typeof orgQuery>>[number];

/** One page of organizations, newest first. */
export function orgsPage(cursor: Cursor | null): Promise<Page<OrgRow>> {
  return withService((tx) =>
    orgQuery(tx)
      .where(keysetWhere(organizations, KEY, cursor))
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
