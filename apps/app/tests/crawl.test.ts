import { afterEach, describe, expect, it, vi } from "vitest";
import { parseFacts, rankLinks } from "../lib/profile/crawl";

describe("rankLinks", () => {
  const html = `
    <a href="/blog/post">Blog</a>
    <a href="/contact">Contact</a>
    <a href='/about-us'>About</a>
    <a href="https://other.com/about">Elsewhere</a>
    <a href="/services#x">Services</a>
    <a href="/about-us?x=1">About again</a>
    <a href="mailto:hi@acme.com">Mail</a>
    <a href="https://www.acme.com/team">Team</a>`;

  it("keeps same-site keyword pages, best keyword first, deduped", () => {
    expect(rankLinks("https://acme.com/", html)).toEqual([
      "https://acme.com/about-us",
      "https://acme.com/services",
      "https://acme.com/contact",
      "https://www.acme.com/team",
    ]);
  });
  it("honours max", () => expect(rankLinks("https://acme.com/", html, 2)).toHaveLength(2));
  it("never returns the page itself", () => {
    expect(rankLinks("https://acme.com/about", '<a href="/about">me</a>')).toEqual([]);
  });
});

describe("parseFacts", () => {
  it("reads LocalBusiness JSON-LD", () => {
    const html = `<script type="application/ld+json">${JSON.stringify({
      "@context": "https://schema.org",
      "@type": "LocalBusiness",
      name: "Northwind IT",
      telephone: "(614) 555-0100",
      email: "mailto:hello@northwind.it",
      address: { "@type": "PostalAddress", streetAddress: "120 Main St", addressLocality: "Columbus", addressRegion: "OH", postalCode: "43215" },
      openingHours: ["Mo-Fr 08:00-18:00", "Sa 09:00-12:00"],
    })}</script>`;
    expect(parseFacts(html)).toEqual({
      name: "Northwind IT",
      phone: "(614) 555-0100",
      email: "hello@northwind.it",
      address: "120 Main St, Columbus, OH 43215",
      hours: "Mo-Fr 08:00-18:00\nSa 09:00-12:00",
    });
  });
  it("finds the organisation inside an @graph", () => {
    const html = `<script type="application/ld+json">${JSON.stringify({ "@graph": [{ "@type": "WebSite", name: "x" }, { "@type": "Organization", name: "Acme" }] })}</script>`;
    expect(parseFacts(html).name).toBe("Acme");
  });
  it("falls back to tel: and mailto: links", () => {
    expect(parseFacts('<a href="tel:+16145550100">Call</a><a href="mailto:hi@acme.com?subject=Hi">Mail</a>')).toEqual({
      phone: "+16145550100",
      email: "hi@acme.com",
    });
  });
  it("survives broken JSON-LD", () => {
    expect(parseFacts('<script type="application/ld+json">{nope</script>')).toEqual({});
  });
});

describe("crawlSite", () => {
  const page = (body: string) => `<html><body>${body}</body></html>`;
  const long = "We install and manage networks for small businesses. ".repeat(10);

  async function load(fetcher: (u: string, opts?: { signal?: AbortSignal }) => Promise<{ url: string; html: string }>) {
    vi.resetModules();
    vi.doMock("../lib/http/safe-fetch", async (orig) => ({ ...(await orig<object>()), safeFetchHtml: fetcher }));
    return import("../lib/profile/crawl");
  }
  afterEach(() => vi.doUnmock("../lib/http/safe-fetch"));

  it("reads the homepage plus ranked pages, homepage facts winning", async () => {
    const pages: Record<string, string> = {
      "https://acme.com/": page(`<a href="/about">a</a><a href="mailto:home@acme.com">m</a>${long}`),
      "https://acme.com/about": page(`<a href="mailto:footer@acme.com">m</a>About us. ${long}`),
    };
    const { crawlSite } = await load(async (u) => ({ url: u, html: pages[u] ?? "" }));
    const r = await crawlSite("https://acme.com/");
    expect(r.pages.map((p) => p.url)).toEqual(["https://acme.com/", "https://acme.com/about"]);
    expect(r.facts.email).toBe("home@acme.com");
  });

  it("keeps going when a secondary page fails", async () => {
    const { crawlSite } = await load(async (u) => {
      if (u.endsWith("/about")) throw new Error("boom");
      return { url: u, html: page(`<a href="/about">a</a>${long}`) };
    });
    expect((await crawlSite("https://acme.com/")).pages).toHaveLength(1);
  });

  it("says empty for a site with almost no readable text", async () => {
    const { crawlSite } = await load(async (u) => ({ url: u, html: page('<div id="root"></div><script>app()</script>') }));
    await expect(crawlSite("https://spa.example")).rejects.toMatchObject({ code: "empty" });
  });

  it("maps blocked, unreachable and invalid input", async () => {
    type Mod = typeof import("../lib/http/safe-fetch");
    const cases: [(m: Mod) => unknown, string][] = [
      [(m) => new m.SafeFetchError("blocked"), "blocked"],
      [(m) => new m.SafeFetchError("not_html"), "unreachable"],
      [() => new Error("invalid"), "invalid"],
      [() => new TypeError("fetch failed"), "unreachable"],
    ];
    for (const [make, code] of cases) {
      const box: { err?: unknown } = {};
      const { crawlSite } = await load(async () => {
        throw box.err;
      });
      box.err = make(await import("../lib/http/safe-fetch"));
      await expect(crawlSite("x")).rejects.toMatchObject({ code });
    }
  });

  it("hands one shared deadline signal to every fetch", async () => {
    const seen: (AbortSignal | undefined)[] = [];
    const { crawlSite } = await load(async (u, opts) => {
      seen.push(opts?.signal);
      return { url: u, html: page(`<a href="/about">a</a>${long}`) };
    });
    await crawlSite("https://acme.com/");
    expect(seen).toHaveLength(2);
    expect(seen[0]).toBeInstanceOf(AbortSignal);
    expect(seen[1]).toBe(seen[0]);
  });
});
