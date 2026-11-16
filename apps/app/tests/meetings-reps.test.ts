import { describe, expect, it } from "vitest";
import { repOptions, tallyReps } from "../lib/meetings/reps";

const m = (userId: string, firstName: string | null, lastName: string | null, email: string | null, support = false) => ({ userId, firstName, lastName, email, support });

describe("repOptions", () => {
  const { options, names } = repOptions([m("b", "Zed", "Moss", "z@x.co"), m("s", "Alevo", "Staff", "s@alevo.com", true), m("a", null, null, "amy@x.co")]);

  it("starts with Unassigned and leaves support staff out", () => {
    expect(options[0]).toEqual({ value: "", label: "Unassigned" });
    expect(options.map((o) => o.value)).toEqual(["", "a", "b"]);
  });

  it("names people by name, falling back to email", () => {
    expect(names.get("b")).toBe("Zed Moss");
    expect(names.get("a")).toBe("amy@x.co");
    expect(names.has("s")).toBe(false);
  });
});

describe("tallyReps", () => {
  const names = new Map([["a", "Amy"], ["b", "Ben"]]);

  it("sorts reps by count, Unassigned last, and drops zero counts", () => {
    const rows = tallyReps([{ repUserId: null, n: 5 }, { repUserId: "a", n: 1 }, { repUserId: "b", n: 3 }, { repUserId: "a", n: 0 }], names);
    expect(rows.map((r) => [r.label, r.n])).toEqual([["Ben", 3], ["Amy", 1], ["Unassigned", 5]]);
  });

  it("folds ids that are no longer members into one Former member row", () => {
    const rows = tallyReps([{ repUserId: "gone1", n: 2 }, { repUserId: "gone2", n: 1 }], names);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ label: "Former member", n: 3 });
  });

  it("is empty when there are no meetings", () => {
    expect(tallyReps([], names)).toEqual([]);
  });
});
