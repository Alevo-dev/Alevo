import { describe, expect, it } from "vitest";
import { slowOrgs, speedDigest } from "../lib/alerts/speed-digest";

const rows = [
  { name: "Fast MSP", replied: 12, p50: 8, p95: 40 },
  { name: "Slow MSP", replied: 5, p50: 70, p95: 190 },
  { name: "Tiny MSP", replied: 1, p50: 400, p95: 400 },
  { name: "Quiet MSP", replied: 0, p50: null, p95: null },
  { name: "Slower MSP", replied: 3, p50: 30, p95: 600 },
];

describe("slowOrgs", () => {
  it("keeps orgs over the 60s p95 target with enough replies, slowest first", () => {
    expect(slowOrgs(rows).map((r) => r.name)).toEqual(["Slower MSP", "Slow MSP"]);
  });
  it("respects custom thresholds", () => {
    expect(slowOrgs(rows, 30, 1).map((r) => r.name)).toEqual(["Slower MSP", "Tiny MSP", "Slow MSP", "Fast MSP"]);
  });
});

describe("speedDigest", () => {
  it("is silent when nothing is slow", () => {
    expect(speedDigest([])).toBeNull();
  });
  it("lists each slow org with its numbers", () => {
    const text = speedDigest(slowOrgs(rows));
    expect(text).toContain("Speed to lead over target (60s) — last 24 hours");
    expect(text).toContain("• Slower MSP: p95 10m 0s, median 30s over 3 answered leads");
    expect(text).toContain("• Slow MSP: p95 3m 10s, median 1m 10s over 5 answered leads");
  });
});
