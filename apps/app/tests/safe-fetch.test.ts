import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("node:dns/promises", () => ({
  lookup: async (host: string) => {
    if (host === "localhost") return [{ address: "127.0.0.1", family: 4 }];
    if (host === "nxdomain.test") throw new Error("ENOTFOUND");
    return [{ address: "93.184.216.34", family: 4 }];
  },
}));

import { assertPublicUrl, isBlockedIp, normalizeUrl, safeFetchHtml, SafeFetchError } from "../lib/http/safe-fetch";

afterEach(() => vi.unstubAllGlobals());

const html = (body: BodyInit, type = "text/html; charset=utf-8", init: ResponseInit = {}) =>
  new Response(body, { status: 200, ...init, headers: { "content-type": type, ...(init.headers as object) } });

describe("isBlockedIp", () => {
  it.each([
    "127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254",
    "100.64.0.1", "0.0.0.0", "224.0.0.1", "::1", "::", "fd00::1", "fe80::1", "::ffff:127.0.0.1", "::ffff:7f00:1",
  ])("blocks %s", (ip) => expect(isBlockedIp(ip)).toBe(true));

  it.each(["8.8.8.8", "172.32.0.1", "93.184.216.34", "2606:4700::1111", "::ffff:8.8.8.8"])("allows %s", (ip) =>
    expect(isBlockedIp(ip)).toBe(false),
  );

  it("fails closed on anything that is not an IP", () => expect(isBlockedIp("not-an-ip")).toBe(true));
});

describe("normalizeUrl", () => {
  it("adds https when the scheme is missing", () => expect(normalizeUrl("acme.com").href).toBe("https://acme.com/"));
  it("keeps a port on a bare host", () => expect(normalizeUrl("acme.com:8080").port).toBe("8080"));
  it("refuses non-http schemes and credentials", () => {
    for (const bad of ["ftp://x.com", "file:///etc/passwd", "https://u:p@x.com"]) {
      expect(() => normalizeUrl(bad), bad).toThrow(SafeFetchError);
      try {
        normalizeUrl(bad);
      } catch (e) {
        expect((e as SafeFetchError).code).toBe("blocked");
      }
    }
  });
  it("rejects empty and unparsable input as invalid", () => {
    expect(() => normalizeUrl("   ")).toThrow("invalid");
    expect(() => normalizeUrl("javascript:alert(1)")).toThrow("invalid");
  });
});

describe("assertPublicUrl", () => {
  it.each(["http://2130706433", "http://localhost", "http://[::ffff:7f00:1]", "http://169.254.169.254/latest/meta-data"])(
    "refuses %s",
    async (u) => {
      await expect(assertPublicUrl(u)).rejects.toMatchObject({ code: "blocked" });
    },
  );
  it("allows a public host", async () => {
    expect((await assertPublicUrl("https://example.com/a")).hostname).toBe("example.com");
  });
  it("reports an unresolvable host as unreachable", async () => {
    await expect(assertPublicUrl("https://nxdomain.test")).rejects.toMatchObject({ code: "unreachable" });
  });
});

describe("safeFetchHtml", () => {
  it("returns the page html", async () => {
    vi.stubGlobal("fetch", async () => html("<p>hi</p>"));
    expect(await safeFetchHtml("https://example.com")).toEqual({ url: "https://example.com/", html: "<p>hi</p>" });
  });

  it("refuses a redirect to a private address", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 302, headers: { location: "http://127.0.0.1/admin" } }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(safeFetchHtml("https://example.com")).rejects.toMatchObject({ code: "blocked" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("follows a safe redirect, then gives up after the limit", async () => {
    let n = 0;
    vi.stubGlobal("fetch", async () => new Response(null, { status: 301, headers: { location: `/hop${++n}` } }));
    await expect(safeFetchHtml("https://example.com", { maxRedirects: 2 })).rejects.toMatchObject({ code: "unreachable" });
    expect(n).toBe(3);
  });

  it("rejects non-HTML content", async () => {
    vi.stubGlobal("fetch", async () => html("%PDF-1.7", "application/pdf"));
    await expect(safeFetchHtml("https://example.com/a.pdf")).rejects.toMatchObject({ code: "not_html" });
  });

  it("aborts a body larger than maxBytes", async () => {
    const stream = new ReadableStream({
      start(c) {
        c.enqueue(new TextEncoder().encode("x".repeat(100)));
        c.close();
      },
    });
    vi.stubGlobal("fetch", async () => html(stream));
    await expect(safeFetchHtml("https://example.com", { maxBytes: 10 })).rejects.toMatchObject({ code: "too_large" });
  });

  it("maps a non-2xx and a network failure to unreachable", async () => {
    vi.stubGlobal("fetch", async () => new Response("no", { status: 500, headers: { "content-type": "text/html" } }));
    await expect(safeFetchHtml("https://example.com")).rejects.toMatchObject({ code: "unreachable" });
    vi.stubGlobal("fetch", async () => {
      throw new TypeError("fetch failed");
    });
    await expect(safeFetchHtml("https://example.com")).rejects.toMatchObject({ code: "unreachable" });
  });
});

describe("safeFetchHtml deadline", () => {
  it("gives up as soon as the caller's signal aborts, not at the per-request timeout", async () => {
    vi.stubGlobal(
      "fetch",
      (_u: unknown, init: RequestInit) =>
        new Promise((_, reject) => init.signal!.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")))),
    );
    const started = Date.now();
    await expect(safeFetchHtml("https://example.com", { timeoutMs: 5000, signal: AbortSignal.timeout(30) })).rejects.toMatchObject({
      code: "unreachable",
    });
    expect(Date.now() - started).toBeLessThan(1500);
  });
});
