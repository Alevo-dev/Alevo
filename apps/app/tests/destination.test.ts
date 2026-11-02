import { describe, expect, it } from "vitest";
import { allowedDestination } from "../lib/admin/destination";

/** The console's deep links may only land on app pages — never off-site, never an API route. */
describe("allowedDestination", () => {
  it("keeps app pages", () => {
    expect(allowedDestination("/workspace/integrations")).toBe("/workspace/integrations");
    expect(allowedDestination("/conversations")).toBe("/conversations");
    expect(allowedDestination("/dashboard")).toBe("/dashboard");
  });

  it.each(["https://evil.example", "//evil.example", "/api/webhooks/clerk", "/workspace/../admin", "/workspace/integrations?x=1", undefined, ""])(
    "falls back to the dashboard for %s",
    (to) => {
      expect(allowedDestination(to)).toBe("/dashboard");
    },
  );
});
