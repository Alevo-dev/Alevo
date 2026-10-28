import { describe, expect, it } from "vitest";
import { encodeCursor, finishPage, PAGE_SIZE, pageCount, parseCursor } from "@alevo/db";

/** Pure keyset bookkeeping: cursors in the URL and the edges of a page. No DB. */

const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const rows = (n: number) => Array.from({ length: n }, (_, i) => ({ id: ID(i + 1) }));

describe("parseCursor", () => {
  it("round-trips what encodeCursor writes, page number included", () => {
    expect(parseCursor(encodeCursor("older", ID(7), 2))).toEqual({ dir: "older", id: ID(7), page: 2 });
    expect(parseCursor(encodeCursor("newer", ID(7), 1))).toEqual({ dir: "newer", id: ID(7), page: 1 });
  });

  it("treats anything malformed as the first page", () => {
    expect(parseCursor(undefined)).toBeNull();
    expect(parseCursor("")).toBeNull();
    expect(parseCursor("older")).toBeNull();
    expect(parseCursor("older." + ID(1))).toBeNull(); // yesterday's shape, no page
    expect(parseCursor("sideways." + ID(1) + ".2")).toBeNull();
    expect(parseCursor("older.not-a-uuid.2")).toBeNull();
    expect(parseCursor("older.1 or 1=1.2")).toBeNull();
    expect(parseCursor("older." + ID(1) + ".0")).toBeNull();
    expect(parseCursor("older." + ID(1) + ".x")).toBeNull();
    expect(parseCursor("older." + ID(1) + ".2.3")).toBeNull();
  });
});

describe("pageCount", () => {
  it("rounds up and never says 0 pages", () => {
    expect(pageCount(0)).toBe(1);
    expect(pageCount(PAGE_SIZE)).toBe(1);
    expect(pageCount(PAGE_SIZE + 1)).toBe(2);
    expect(pageCount(60)).toBe(3);
  });
});

describe("finishPage", () => {
  it("first page that fits: page 1, no links", () => {
    const page = finishPage(rows(10), null);
    expect(page.rows).toHaveLength(10);
    expect(page.page).toBe(1);
    expect(page.newer).toBeNull();
    expect(page.older).toBeNull();
  });

  it("first page with a spare row: Next only, anchored on the last shown row, pointing at page 2", () => {
    const page = finishPage(rows(PAGE_SIZE + 1), null);
    expect(page.rows).toHaveLength(PAGE_SIZE);
    expect(page.newer).toBeNull();
    expect(page.older).toBe(encodeCursor("older", ID(PAGE_SIZE), 2));
  });

  it("walking older: Previous is always there, Next only with a spare row; pages count on", () => {
    const cursor = { dir: "older" as const, id: ID(99), page: 3 };
    const last = finishPage(rows(5), cursor);
    expect(last.page).toBe(3);
    expect(last.newer).toBe(encodeCursor("newer", ID(1), 2));
    expect(last.older).toBeNull();
    const mid = finishPage(rows(PAGE_SIZE + 1), cursor);
    expect(mid.older).toBe(encodeCursor("older", ID(PAGE_SIZE), 4));
  });

  it("walking newer: rows come back newest-first and Next is always there", () => {
    const cursor = { dir: "newer" as const, id: ID(99), page: 2 };
    // Fetched ascending (oldest of the newer rows first) with a spare.
    const page = finishPage(rows(PAGE_SIZE + 1), cursor);
    expect(page.page).toBe(2);
    expect(page.rows[0]?.id).toBe(ID(PAGE_SIZE));
    expect(page.rows[PAGE_SIZE - 1]?.id).toBe(ID(1));
    expect(page.newer).toBe(encodeCursor("newer", ID(PAGE_SIZE), 1));
    expect(page.older).toBe(encodeCursor("older", ID(1), 3));
    const top = finishPage(rows(3), cursor);
    expect(top.newer).toBeNull();
    expect(top.older).toBe(encodeCursor("older", ID(1), 3));
  });

  it("never points Previous below page 1, even if rows were added above", () => {
    const page = finishPage(rows(PAGE_SIZE + 1), { dir: "newer", id: ID(99), page: 1 });
    expect(page.newer).toBe(encodeCursor("newer", ID(PAGE_SIZE), 1));
  });

  it("an anchor that no longer exists gives an empty page with no links", () => {
    expect(finishPage([], { dir: "older", id: ID(1), page: 2 })).toEqual({ rows: [], newer: null, older: null, page: 2 });
  });
});
