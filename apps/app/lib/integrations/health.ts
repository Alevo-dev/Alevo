import { and, eq, gte, sql } from "drizzle-orm";
import { webhookDeliveries } from "@alevo/db";
import { withOrg } from "@alevo/auth";

const HOURS = 24;
const HOUR_MS = 3_600_000;

export type HealthBucket = { at: number; ok: number; failed: number };

export type ConnectionHealth = {
  /** One per hour, oldest first, ending at the current hour. */
  buckets: HealthBucket[];
  ok: number;
  failed: number;
  total: number;
  /** ok / total, or null when nothing has arrived in the window. */
  successRate: number | null;
};

/**
 * Webhook outcomes for this org over the last 24 hours, bucketed by hour. The
 * hour is taken from the epoch, so buckets fall on whole UTC hours whatever the
 * database's time zone. Explicit org filter: platform admins bypass RLS.
 */
export async function getConnectionHealth(orgId: string): Promise<ConnectionHealth> {
  const start = Math.floor(Date.now() / HOUR_MS) * HOUR_MS - (HOURS - 1) * HOUR_MS;
  const hour = sql<Date>`to_timestamp(floor(extract(epoch from ${webhookDeliveries.createdAt}) / 3600) * 3600)`;

  const rows = await withOrg((tx) =>
    tx
      .select({
        hour,
        ok: sql<number>`count(*) filter (where ${webhookDeliveries.outcome} = 'ok')::int`,
        failed: sql<number>`count(*) filter (where ${webhookDeliveries.outcome} = 'failed')::int`,
      })
      .from(webhookDeliveries)
      .where(and(eq(webhookDeliveries.orgId, orgId), gte(webhookDeliveries.createdAt, new Date(start))))
      .groupBy(hour),
  );

  const byHour = new Map(rows.map((r) => [new Date(r.hour).getTime(), r]));
  const buckets: HealthBucket[] = Array.from({ length: HOURS }, (_, i) => {
    const at = start + i * HOUR_MS;
    const row = byHour.get(at);
    return { at, ok: row?.ok ?? 0, failed: row?.failed ?? 0 };
  });

  const ok = buckets.reduce((sum, b) => sum + b.ok, 0);
  const failed = buckets.reduce((sum, b) => sum + b.failed, 0);
  const total = ok + failed;
  return { buckets, ok, failed, total, successRate: total > 0 ? ok / total : null };
}
