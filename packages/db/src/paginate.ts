import { asc, desc, sql, type AnyColumn, type SQL } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";

/**
 * Keyset pagination for every list that can grow without bound (audit log,
 * organizations, conversations, meetings). A page is `PAGE_SIZE` rows newest
 * first; the reader walks with Newer / Older links that carry an opaque cursor
 * in the URL. No OFFSET (cost grows with the page number) and no COUNT per page.
 */

/** Rows per page, everywhere. */
export const PAGE_SIZE = 25;

export type PageDir = "older" | "newer";
/** Where a page starts: the row the reader was last looking at, and which way to go. */
export type Cursor = { dir: PageDir; id: string };
export type Page<T> = { rows: T[]; newer: string | null; older: string | null };

/** The sort column (or expression) and the tie-breaker id. */
type Keyed = { at: AnyColumn | SQL; id: AnyColumn };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** `older.<id>` / `newer.<id>`: URL-safe, nothing kept server-side. */
export function encodeCursor(dir: PageDir, id: string): string {
  return `${dir}.${id}`;
}

/** Anything malformed reads as "first page". */
export function parseCursor(raw: unknown): Cursor | null {
  if (typeof raw !== "string") return null;
  const dot = raw.indexOf(".");
  const dir = raw.slice(0, dot);
  const id = raw.slice(dot + 1);
  if ((dir !== "older" && dir !== "newer") || !UUID.test(id)) return null;
  return { dir, id };
}

/**
 * `where` for the page after `cursor`. The anchor row's position is read in SQL
 * (one primary-key lookup) so the comparison keeps Postgres' microsecond
 * precision; a cursor whose row is gone yields an empty page. `undefined` on
 * the first page — hand it to `and()` together with the tenant scope.
 */
export function keysetWhere(table: PgTable, cols: Keyed, cursor: Cursor | null): SQL | undefined {
  if (!cursor) return undefined;
  const anchor = sql`(select ${cols.at}, ${cols.id} from ${table} where ${cols.id} = ${cursor.id})`;
  return cursor.dir === "older" ? sql`(${cols.at}, ${cols.id}) < ${anchor}` : sql`(${cols.at}, ${cols.id}) > ${anchor}`;
}

/** Walk away from the anchor; `finishPage` turns a "newer" walk back to newest-first. */
export function keysetOrder(cols: Keyed, cursor: Cursor | null): SQL[] {
  const dir = cursor?.dir === "newer" ? asc : desc;
  return [dir(cols.at), dir(cols.id)];
}

/** Fetch `size + 1` rows: the spare one only says whether there is a next page. */
export function finishPage<T extends { id: string }>(fetched: T[], cursor: Cursor | null, size = PAGE_SIZE): Page<T> {
  const more = fetched.length > size;
  const rows = fetched.slice(0, size);
  if (cursor?.dir === "newer") rows.reverse();
  const first = rows[0];
  const last = rows[rows.length - 1];
  if (!first || !last) return { rows, newer: null, older: null };
  const hasNewer = cursor ? cursor.dir === "older" || more : false;
  const hasOlder = cursor?.dir === "newer" || more;
  return {
    rows,
    newer: hasNewer ? encodeCursor("newer", first.id) : null,
    older: hasOlder ? encodeCursor("older", last.id) : null,
  };
}
