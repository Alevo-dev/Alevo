import { eq, sql } from "drizzle-orm";
import { organizations } from "./schema/identity";
import { vendorSpend } from "./schema/vendor-spend";
import { withService } from "./with-tenant";

export type SpendEnv = "development" | "staging" | "production";

export type SpendEvent = {
  env: SpendEnv;
  provider: string;
  kind: string;
  orgId?: string | null;
  units: number;
  costUsd: number;
  /** false when the vendor reported the cost itself. */
  estimated?: boolean;
  detail?: string | null;
};

/** Write one vendor call's cost. Service path; callers must not let a failure here break the call they measured. */
export async function recordSpend(e: SpendEvent): Promise<void> {
  await withService((tx) =>
    tx.insert(vendorSpend).values({
      env: e.env,
      provider: e.provider,
      kind: e.kind,
      orgId: e.orgId ?? null,
      units: String(e.units),
      costUsd: e.costUsd.toFixed(6),
      estimated: e.estimated ?? true,
      detail: e.detail ?? null,
    }),
  );
}

/** The model behind a row: AI and embedding rows store it in `detail`; other vendors have none. */
const modelOf = sql<string | null>`case when ${vendorSpend.provider} in ('anthropic', 'voyage') then ${vendorSpend.detail} end`;

export type SpendRow = { env: string; provider: string; kind: string; model: string | null; calls: number; units: number; costUsd: number; estimatedUsd: number };

/** Spend over the last `days` days, grouped by environment, provider and kind. Cross-tenant: the admin console only. */
export async function spendSummary(days: number): Promise<SpendRow[]> {
  // Whole calendar days (UTC), today included, so the totals match the chart's buckets.
  const since = sql`(current_date - ${Math.max(1, Math.floor(days)) - 1}::int)::timestamptz`;
  const rows = await withService((tx) =>
    tx
      .select({
        env: vendorSpend.env,
        provider: vendorSpend.provider,
        kind: vendorSpend.kind,
        model: modelOf.as("model"),
        calls: sql<number>`count(*)`.mapWith(Number),
        units: sql<number>`coalesce(sum(${vendorSpend.units}), 0)`.mapWith(Number),
        costUsd: sql<number>`coalesce(sum(${vendorSpend.costUsd}), 0)`.mapWith(Number),
        estimatedUsd: sql<number>`coalesce(sum(${vendorSpend.costUsd}) filter (where ${vendorSpend.estimated}), 0)`.mapWith(Number),
      })
      .from(vendorSpend)
      .where(sql`${vendorSpend.createdAt} >= ${since}`)
      .groupBy(vendorSpend.env, vendorSpend.provider, vendorSpend.kind, sql`model`),
  );
  return rows;
}

export type OrgSpend = { orgId: string | null; name: string | null; env: string; calls: number; costUsd: number };

/** Spend over the same calendar window per organization and environment (`orgId` null = not tied to an org). */
export async function spendByOrg(days: number): Promise<OrgSpend[]> {
  const since = sql`(current_date - ${Math.max(1, Math.floor(days)) - 1}::int)::timestamptz`;
  return withService((tx) =>
    tx
      .select({
        orgId: vendorSpend.orgId,
        name: organizations.name,
        env: vendorSpend.env,
        calls: sql<number>`count(*)`.mapWith(Number),
        costUsd: sql<number>`coalesce(sum(${vendorSpend.costUsd}), 0)`.mapWith(Number),
      })
      .from(vendorSpend)
      .leftJoin(organizations, eq(organizations.id, vendorSpend.orgId))
      .where(sql`${vendorSpend.createdAt} >= ${since}`)
      .groupBy(vendorSpend.orgId, organizations.name, vendorSpend.env),
  );
}

/**
 * Spend per environment per period, for the trend chart: `ago` = 0 is the latest bucket.
 * Today (1) is per hour (`ago` = 23 − the UTC hour), under 90 days per day, 90 per week.
 */
export async function spendSeries(days: number): Promise<{ ago: number; env: string; costUsd: number }[]> {
  const span = Math.max(1, Math.floor(days));
  const weekly = span >= 90;
  const cover = weekly ? Math.ceil(span / 7) * 7 : span;
  const since = sql`(current_date - ${cover - 1}::int)::timestamptz`;
  const at = sql`(${vendorSpend.createdAt} at time zone 'UTC')`;
  const ago =
    span === 1
      ? sql<number>`(23 - extract(hour from ${at}))`
      : weekly
        ? sql<number>`floor((current_date - ${at}::date) / 7)`
        : sql<number>`(current_date - ${at}::date)`;
  return withService((tx) =>
    tx
      .select({ ago: ago.mapWith(Number).as("ago"), env: vendorSpend.env, costUsd: sql<number>`sum(${vendorSpend.costUsd})`.mapWith(Number) })
      .from(vendorSpend)
      .where(sql`${vendorSpend.createdAt} >= ${since}`)
      .groupBy(sql`ago`, vendorSpend.env),
  );
}
