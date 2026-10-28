import { describe, expect, it } from "vitest";
import { encodeCursor, finishPage, PAGE_SIZE, parseCursor } from "@alevo/db";

/** Pure keyset bookkeeping: cursors in the URL and the edges of a page. No DB. */

const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const rows = (n: number) => Array.from({ length: n }, (_, i) => ({ id: ID(i + 1) }));

describe("parseCursor", () => {
  it("round-trips what encodeCursor writes", () => {
    expect(parseCursor(encodeCursor("older", ID(7)))).toEqual({ dir: "older", id: ID(7) });
    expect(parseCursor(encodeCursor("newer", ID(7)))).toEqual({ dir: "newer", id: ID(7) });
  });

  it("treats anything malformed as the first page", () => {
    expect(parseCursor(undefined)).toBeNull();
    expect(parseCursor("")).toBeNull();
    expect(parseCursor("older")).toBeNull();
    expect(parseCursor("sideways." + ID(1))).toBeNull();
    expect(parseCursor("older.not-a-uuid")).toBeNull();
    expect(parseCursor("older.1 or 1=1")).toBeNull();
  });
});

describe("finishPage", () => {
  it("first page that fits: no links", () => {
    const page = finishPage(rows(10), null);
    expect(page.rows).toHaveLength(10);
    expect(page.newer).toBeNull();
    expect(page.older).toBeNull();
  });

  it("first page with a spare row: Older only, anchored on the last shown row", () => {
    const page = finishPage(rows(PAGE_SIZE + 1), null);
    expect(page.rows).toHaveLength(PAGE_SIZE);
    expect(page.newer).toBeNull();
    expect(page.older).toBe(encodeCursor("older", ID(PAGE_SIZE)));
  });

  it("walking older: Newer is always there, Older only with a spare row", () => {
    const cursor = { dir: "older" as const, id: ID(99) };
    const last = finishPage(rows(5), cursor);
    expect(last.newer).toBe(encodeCursor("newer", ID(1)));
    expect(last.older).toBeNull();
    const mid = finishPage(rows(PAGE_SIZE + 1), cursor);
    expect(mid.older).toBe(encodeCursor("older", ID(PAGE_SIZE)));
  });

  it("walking newer: rows come back newest-first and Older is always there", () => {
    const cursor = { dir: "newer" as const, id: ID(99) };
    // Fetched ascending (oldest of the newer rows first) with a spare.
    const page = finishPage(rows(PAGE_SIZE + 1), cursor);
    expect(page.rows[0]?.id).toBe(ID(PAGE_SIZE));
    expect(page.rows[PAGE_SIZE - 1]?.id).toBe(ID(1));
    expect(page.newer).toBe(encodeCursor("newer", ID(PAGE_SIZE)));
    expect(page.older).toBe(encodeCursor("older", ID(1)));
    const top = finishPage(rows(3), cursor);
    expect(top.newer).toBeNull();
    expect(top.older).toBe(encodeCursor("older", ID(1)));
  });

  it("an anchor that no longer exists gives an empty page with no links", () => {
    expect(finishPage([], { dir: "older", id: ID(1) })).toEqual({ rows: [], newer: null, older: null });
  });
});
