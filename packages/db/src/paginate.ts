import { asc, desc, sql, type AnyColumn, type SQL } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";

/**
 * Keyset pagination for every list that can grow without bound (audit log,
 * organizations, conversations, meetings). A page is `PAGE_SIZE` rows newest
 * first; the reader walks with Previous / Next links that carry an opaque
 * cursor in the URL: the anchor row, the direction, and the page number being
 * opened (so the footer can say "Page 3 of 12" without counting). No OFFSET
 * (cost grows with the page number) and no COUNT per page beyond the one total
 * the header already shows.
 */

/** Rows per page, everywhere. */
export const PAGE_SIZE = 25;

export type PageDir = "older" | "newer";
/** Where a page starts: the row the reader was last looking at, which way to go, and the page number they land on. */
export type Cursor = { dir: PageDir; id: string; page: number };
export type Page<T> = { rows: T[]; newer: string | null; older: string | null; page: number };

/** How many pages a list of `total` rows has (never 0, so "Page 1 of 1" reads right). */
export function pageCount(total: number, size = PAGE_SIZE): number {
  return Math.max(1, Math.ceil(total / size));
}

/** The sort column (or expression) and the tie-breaker id. */
type Keyed = { at: AnyColumn | SQL; id: AnyColumn };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** `older.<id>.<page>` / `newer.<id>.<page>`: URL-safe, nothing kept server-side. */
export function encodeCursor(dir: PageDir, id: string, page: number): string {
  return `${dir}.${id}.${page}`;
}

/** Anything malformed reads as "first page". */
export function parseCursor(raw: unknown): Cursor | null {
  if (typeof raw !== "string") return null;
  const [dir, id, pageRaw, ...rest] = raw.split(".");
  if ((dir !== "older" && dir !== "newer") || !id || !UUID.test(id) || rest.length > 0) return null;
  const page = Number(pageRaw);
  if (!/^\d+$/.test(pageRaw ?? "") || page < 1) return null;
  return { dir, id, page };
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
  const page = cursor?.page ?? 1;
  const more = fetched.length > size;
  const rows = fetched.slice(0, size);
  if (cursor?.dir === "newer") rows.reverse();
  const first = rows[0];
  const last = rows[rows.length - 1];
  if (!first || !last) return { rows, newer: null, older: null, page };
  const hasNewer = cursor ? cursor.dir === "older" || more : false;
  const hasOlder = cursor?.dir === "newer" || more;
  return {
    rows,
    newer: hasNewer ? encodeCursor("newer", first.id, Math.max(1, page - 1)) : null,
    older: hasOlder ? encodeCursor("older", last.id, page + 1) : null,
    page,
  };
}
