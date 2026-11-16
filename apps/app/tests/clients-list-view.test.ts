import { describe, expect, it } from "vitest";
import { csvCell, toCsv } from "../lib/clients/csv";
import { DEFAULT_COLUMNS, nextSort, parseColumns, sortRows, type ListRow } from "../lib/clients/list-view";

describe("csvCell", () => {
  it("quotes commas, quotes and newlines", () => {
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell("one\ntwo")).toBe('"one\ntwo"');
  });
  it("neutralises formulas", () => {
    for (const v of ["=1+1", "+44", "-2", "@SUM(A1)", "\tx"]) expect(csvCell(v).startsWith("'")).toBe(true);
    expect(csvCell("=HYPERLINK(\"x\",\"y\")")).toBe('"\'=HYPERLINK(""x"",""y"")"');
  });
  it("renders empties, numbers and dates", () => {
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
    expect(csvCell(0)).toBe("0");
    expect(csvCell(new Date("2026-01-02T03:04:05Z"))).toBe("2026-01-02T03:04:05.000Z");
  });
  it("joins rows with CRLF", () => {
    expect(toCsv(["a", "b"], [[1, "x,y"]])).toBe('a,b\r\n1,"x,y"\r\n');
  });
});

const row = (o: Partial<ListRow>): ListRow => ({
  id: "1", name: "A", sub: "", channels: [], status: null, maxFit: null, openCount: 0, activityAt: 0, activityLabel: "", timezone: null, consentSource: null, ...o,
});

describe("list view", () => {
  it("parses saved columns and keeps the name column", () => {
    expect(parseColumns(null)).toEqual(DEFAULT_COLUMNS);
    expect(parseColumns("not json")).toEqual(DEFAULT_COLUMNS);
    expect(parseColumns('["fit"]')).toEqual(["client", "fit"]);
    expect(parseColumns('["fit","bogus","timezone"]')).toEqual(["client", "fit", "timezone"]);
  });
  it("cycles the sort", () => {
    const a = nextSort(null, "fit");
    expect(a).toEqual({ key: "fit", dir: "asc" });
    expect(nextSort(a, "fit")).toEqual({ key: "fit", dir: "desc" });
    expect(nextSort(nextSort(a, "fit"), "fit")).toBeNull();
    expect(nextSort(a, "open")).toEqual({ key: "open", dir: "asc" });
  });
  it("sorts with empties last in both directions", () => {
    const rows = [row({ id: "a", maxFit: 40 }), row({ id: "b", maxFit: null }), row({ id: "c", maxFit: 90 })];
    expect(sortRows(rows, { key: "fit", dir: "asc" }).map((r) => r.id)).toEqual(["a", "c", "b"]);
    expect(sortRows(rows, { key: "fit", dir: "desc" }).map((r) => r.id)).toEqual(["c", "a", "b"]);
    expect(sortRows(rows, null)).toBe(rows);
  });
  it("sorts names case-insensitively", () => {
    const rows = [row({ id: "a", name: "bob" }), row({ id: "b", name: "Alice" })];
    expect(sortRows(rows, { key: "client", dir: "asc" }).map((r) => r.id)).toEqual(["b", "a"]);
  });
});
