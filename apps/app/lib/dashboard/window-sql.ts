import { sql, type SQLWrapper } from "drizzle-orm";
import { bucketFor, coverDays, type Window } from "./window";

/**
 * The window's SQL pieces, in the org's timezone: calendar "today", where the
 * window and the period before it start, and `ago(col)` = whole buckets back
 * (0 = this hour / today / this week; Today counts back from the 11 PM bar).
 * Computed in SQL so the render stays pure (no clock reads).
 */
export function windowSql(days: Window, tz: string) {
  const bucket = bucketFor(days);
  const today = sql`(now() at time zone ${tz})::date`;
  const windowStart = sql`(${today} - ${coverDays(days) - 1}::int)::timestamp at time zone ${tz}`;
  const priorStart = sql`(${today} - ${coverDays(days) * 2 - 1}::int)::timestamp at time zone ${tz}`;
  const ago = (col: SQLWrapper) =>
    bucket === "hour"
      ? sql<number>`(23 - extract(hour from (${col} at time zone ${tz}))::int)`.mapWith(Number)
      : bucket === "day"
        ? sql<number>`(${today} - (${col} at time zone ${tz})::date)`.mapWith(Number)
        : sql<number>`floor((${today} - (${col} at time zone ${tz})::date) / 7)`.mapWith(Number);
  return { today, windowStart, priorStart, ago };
}
