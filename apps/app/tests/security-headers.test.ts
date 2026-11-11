import { describe, expect, it } from "vitest";
import nextConfig from "../next.config";

async function headersFor(): Promise<Record<string, string>> {
  const rules = await nextConfig.headers!();
  const out: Record<string, string> = {};
  // Every rule here is the catch-all; a path-specific rule would need real source matching.
  for (const rule of rules) if (rule.source === "/:path*") for (const h of rule.headers) out[h.key.toLowerCase()] = h.value;
  return out;
}

describe("security headers", () => {
  it("sets the baseline headers on every route", async () => {
    const h = await headersFor();
    expect(h["strict-transport-security"]).toMatch(/max-age=\d{7,}/);
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["permissions-policy"]).toContain("camera=()");
  });

  it("stops the app being framed (clickjacking), in CSP and the legacy header", async () => {
    const h = await headersFor();
    expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(h["x-frame-options"]).toBe("DENY");
  });

  it("blocks plugins and base-tag hijacking", async () => {
    const csp = (await headersFor())["content-security-policy"];
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
  });

  it("does not advertise the framework", () => {
    expect(nextConfig.poweredByHeader).toBe(false);
  });
});
