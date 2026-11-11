import { describe, expect, it } from "vitest";
import { cspOptions } from "@alevo/auth/csp";

const DSN = "https://abc123publickey@o4501.ingest.us.sentry.io/987654";

describe("cspOptions", () => {
  it("uses a nonce with strict-dynamic, so inline and third-party scripts need the nonce", () => {
    expect(cspOptions({}).strict).toBe(true);
  });

  it("starts in report-only mode and only enforces when asked", () => {
    expect(cspOptions({}).reportOnly).toBe(true);
    expect(cspOptions({ enforce: "false" }).reportOnly).toBe(true);
    expect(cspOptions({ enforce: "true" }).reportOnly).toBe(false);
  });

  it("blocks framing, plugins and <base> hijacking", () => {
    const d = cspOptions({}).directives;
    expect(d["frame-ancestors"]).toEqual(["'none'"]);
    expect(d["object-src"]).toEqual(["'none'"]);
    expect(d["base-uri"]).toEqual(["'self'"]);
  });

  it("allows direct uploads to R2 and our image hosts, nothing broader", () => {
    const d = cspOptions({}).directives;
    expect(d["connect-src"]).toContain("https://*.r2.cloudflarestorage.com");
    expect(d["img-src"]).toEqual(
      expect.arrayContaining(["data:", "blob:", "https://*.r2.dev", "https://*.r2.cloudflarestorage.com", "https://assets.getalevo.com"]),
    );
    for (const list of Object.values(d)) expect(list).not.toContain("*");
  });

  it("allows the Sentry ingest host and reports violations to Sentry when a DSN is set", () => {
    const o = cspOptions({ dsn: DSN });
    expect(o.directives["connect-src"]).toContain("https://o4501.ingest.us.sentry.io");
    expect(o.reportTo).toBe("https://o4501.ingest.us.sentry.io/api/987654/security/?sentry_key=abc123publickey");
  });

  it("has no Sentry entries and no report endpoint without a DSN", () => {
    const o = cspOptions({});
    expect(o.reportTo).toBeUndefined();
    expect(o.directives["connect-src"].some((s) => s.includes("sentry"))).toBe(false);
  });

  it("ignores a malformed DSN instead of throwing (the proxy runs on every request)", () => {
    expect(() => cspOptions({ dsn: "not a url" })).not.toThrow();
    expect(cspOptions({ dsn: "not a url" }).reportTo).toBeUndefined();
    expect(cspOptions({ dsn: "https://host.example/" }).reportTo).toBeUndefined(); // no key or project id
  });
});
