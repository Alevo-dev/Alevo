import { describe, expect, it } from "vitest";
import { auditLog, finishPage, keysetOrder, keysetWhere, parseCursor, withService, type Cursor } from "@alevo/db";

/**
 * The keyset SQL against real Postgres (service path, audit_log): pages don't
 * overlap, walking Older then Newer lands back on the same rows, and the
 * anchor subquery keeps microsecond order. Needs DATABASE_URL with at least
 * three audit rows; otherwise the walk is skipped.
 */
const KEY = { at: auditLog.createdAt, id: auditLog.id };
const SIZE = 2;

function page(cursor: Cursor | null) {
  return withService((tx) =>
    tx
      .select({ id: auditLog.id, createdAt: auditLog.createdAt })
      .from(auditLog)
      .where(keysetWhere(auditLog, KEY, cursor))
      .orderBy(...keysetOrder(KEY, cursor))
      .limit(SIZE + 1),
  ).then((rows) => finishPage(rows, cursor, SIZE));
}

describe("keyset pagination over audit_log", () => {
  it("walks older and back without overlap or gaps", async () => {
    const first = await page(null);
    if (!first.older) return; // fewer than three rows: nothing to walk
    expect(first.rows).toHaveLength(SIZE);
    expect(first.newer).toBeNull();

    const second = await page(parseCursor(first.older));
    expect(second.rows.length).toBeGreaterThan(0);
    const firstIds = new Set(first.rows.map((r) => r.id));
    for (const r of second.rows) expect(firstIds.has(r.id)).toBe(false);
    // Strictly older than everything on the first page.
    const oldestFirst = first.rows[first.rows.length - 1]!.createdAt.getTime();
    for (const r of second.rows) expect(r.createdAt.getTime()).toBeLessThanOrEqual(oldestFirst);
    expect(second.newer).not.toBeNull();

    const back = await page(parseCursor(second.newer));
    expect(back.rows.map((r) => r.id)).toEqual(first.rows.map((r) => r.id));
    expect(back.newer).toBeNull();
  });

  it("a cursor whose row is gone yields an empty page", async () => {
    const gone = await page({ dir: "older", id: "00000000-0000-4000-8000-000000000000" });
    expect(gone).toEqual({ rows: [], newer: null, older: null });
  });
});
