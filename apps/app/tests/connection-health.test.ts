import { describe, expect, it } from "vitest";
import { shapeHealth } from "../lib/integrations/health";

const NOW = Date.UTC(2026, 10, 13, 15, 30);
const HOUR = 3_600_000;
const thisHour = Math.floor(NOW / HOUR) * HOUR;

describe("shapeHealth", () => {
  it("gives each service its own 24 hourly buckets and rate", () => {
    const h = shapeHealth(
      [
        { hour: thisHour, provider: "resend", ok: 9, failed: 1 },
        { hour: thisHour - 2 * HOUR, provider: "twilio", ok: 4, failed: 0 },
      ],
      [],
      NOW,
    );
    expect(h.providers.map((p) => p.provider)).toEqual(["resend", "twilio"]);
    const resend = h.providers[0]!;
    expect(resend.buckets).toHaveLength(24);
    expect(resend.buckets[23]).toMatchObject({ at: thisHour, ok: 9, failed: 1 });
    expect(resend.successRate).toBeCloseTo(0.9);
    expect(h.total).toBe(14);
    expect(h.failed).toBe(1);
  });
  it("lists a connected service even when quiet, with no rate", () => {
    const slack = shapeHealth([], ["slack"], NOW).providers[0]!;
    expect(slack).toMatchObject({ provider: "slack", total: 0, successRate: null });
  });
  it("leaves out services that are neither connected nor logged", () => {
    expect(shapeHealth([], [], NOW).providers).toEqual([]);
    expect(shapeHealth([], [], NOW).successRate).toBeNull();
  });
});
