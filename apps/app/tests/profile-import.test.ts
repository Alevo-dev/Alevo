import { describe, expect, it } from "vitest";
import { mergeImported } from "../lib/profile/merge";
import { applyFacts } from "../lib/profile/extract";

const blank = {
  companyName: "", businessAddress: "", contactEmail: "", contactPhone: "", contactHours: "",
  offering: "", idealCustomer: "", qualifyingCriteria: "", disqualifiers: "",
};

describe("mergeImported", () => {
  const current = { ...blank, companyName: "Northwind", offering: "  " };

  it("fill mode keeps typed values and fills the blanks", () => {
    const { values, filled } = mergeImported(current, { companyName: "Other Co", offering: "Managed IT" }, "fill");
    expect(values.companyName).toBe("Northwind");
    expect(values.offering).toBe("Managed IT");
    expect(filled).toEqual(["offering"]);
  });

  it("replace mode overwrites what it found and leaves the rest", () => {
    const { values, filled } = mergeImported(current, { companyName: "Other Co", offering: "Managed IT" }, "replace");
    expect(values).toMatchObject({ companyName: "Other Co", offering: "Managed IT" });
    expect(filled).toEqual(["companyName", "offering"]);
  });

  it("never touches fields the import does not cover", () => {
    const withCriteria = { ...blank, qualifyingCriteria: "Size, timeline" };
    expect(mergeImported(withCriteria, { offering: "x" }, "replace").values.qualifyingCriteria).toBe("Size, timeline");
  });

  it("treats blank and placeholder answers as not found", () => {
    for (const junk of ["", "   ", "N/A", "n/a.", "None", "unknown", "null", "Not found", "not available"]) {
      const { values, filled } = mergeImported({ ...blank, offering: "Keep me" }, { offering: junk }, "replace");
      expect(values.offering, junk).toBe("Keep me");
      expect(filled).toEqual([]);
    }
  });

  it("does not count a value that already matches", () => {
    expect(mergeImported({ ...blank, companyName: "Northwind" }, { companyName: "Northwind" }, "replace").filled).toEqual([]);
  });

  it("trims what it writes", () => {
    expect(mergeImported(blank, { companyName: "  Acme  " }, "fill").values.companyName).toBe("Acme");
  });
});

describe("applyFacts", () => {
  it("lets markup facts beat the model", () => {
    expect(applyFacts({ contactPhone: "wrong", offering: "IT" }, { phone: "(614) 555-0100", name: "Acme" })).toEqual({
      contactPhone: "(614) 555-0100",
      companyName: "Acme",
      offering: "IT",
    });
  });
  it("leaves the model value when there is no fact", () => {
    expect(applyFacts({ contactEmail: "a@b.co" }, {})).toEqual({ contactEmail: "a@b.co" });
  });
});
