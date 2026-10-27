import { sql } from "drizzle-orm";
import { rateLimits } from "./schema/rate-limits";
import { withService } from "./with-tenant";

/**
 * Count one hit against `key` in a fixed window and say whether it is still
 * within `limit`. Atomic (one upsert), so concurrent requests can't slip past.
 * A window that has expired restarts at 1. Stale rows are swept now and then
 * so the table stays the size of the recent key set.
 */
export async function hitRateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const expired = sql`${rateLimits.windowStart} < now() - make_interval(secs => ${windowSeconds})`;
  const [row] = await withService(async (tx) => {
    if (Math.random() < 0.01) {
      await tx.delete(rateLimits).where(sql`${rateLimits.windowStart} < now() - interval '1 day'`);
    }
    return tx
      .insert(rateLimits)
      .values({ key, count: 1 })
      .onConflictDoUpdate({
        target: rateLimits.key,
        set: {
          count: sql`case when ${expired} then 1 else ${rateLimits.count} + 1 end`,
          windowStart: sql`case when ${expired} then now() else ${rateLimits.windowStart} end`,
        },
      })
      .returning({ count: rateLimits.count });
  });
  return (row?.count ?? 1) <= limit;
}
