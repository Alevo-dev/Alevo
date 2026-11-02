import { safeFetchHtml, SafeFetchError } from "../http/safe-fetch";
import { htmlToText } from "../kb/html-text";
import { ImportError } from "./import-error";

export type CrawlFacts = { name?: string; phone?: string; email?: string; address?: string; hours?: string };
export type CrawlResult = { pages: { url: string; text: string }[]; facts: CrawlFacts };

const KEYWORDS = ["about", "services", "solutions", "contact", "team", "company", "pricing"];
const PAGE_CHARS = 12_000;
const MIN_TEXT = 200;
// Whole crawl budget. The page allows 60s for crawl + model call, and the model gets 20s of that.
const CRAWL_BUDGET_MS = 30_000;

const bareHost = (u: URL) => u.hostname.replace(/^www\./, "");

/** Same-site links worth reading (About, Services, Contact…), best keyword first. */
export function rankLinks(baseUrl: string, html: string, max = 4): string[] {
  const base = new URL(baseUrl);
  const seen = new Map<string, number>();
  for (const m of html.matchAll(/<a\s[^>]*?href\s*=\s*["']([^"']+)["']/gi)) {
    let u: URL;
    try {
      u = new URL(m[1] ?? "", base);
    } catch {
      continue;
    }
    if ((u.protocol !== "http:" && u.protocol !== "https:") || bareHost(u) !== bareHost(base)) continue;
    u.hash = "";
    u.search = "";
    const path = u.pathname.toLowerCase();
    const score = KEYWORDS.findIndex((k) => path.includes(k));
    if (score < 0 || u.pathname === base.pathname || seen.has(u.href)) continue;
    seen.set(u.href, score);
  }
  return [...seen].sort((a, b) => a[1] - b[1]).slice(0, max).map(([href]) => href);
}

const ORG = /Organization|Business|Corporation|Company|Service|Store/i;

function ldNodes(html: string): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const walk = (n: unknown) => {
    if (Array.isArray(n)) return n.forEach(walk);
    if (!n || typeof n !== "object") return;
    out.push(n as Record<string, unknown>);
    walk((n as Record<string, unknown>)["@graph"]);
  };
  for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      walk(JSON.parse(m[1] ?? ""));
    } catch {
      /* malformed JSON-LD is common; skip it */
    }
  }
  return out;
}

const str = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v.trim() : undefined);

function formatAddress(a: unknown): string | undefined {
  if (typeof a === "string") return str(a);
  if (!a || typeof a !== "object") return undefined;
  const o = a as Record<string, unknown>;
  const region = [str(o.addressRegion), str(o.postalCode)].filter(Boolean).join(" ");
  return [str(o.streetAddress), str(o.addressLocality), region].filter(Boolean).join(", ") || undefined;
}

/** Contact facts read straight from the markup (JSON-LD first, then tel:/mailto: links): more reliable than the model. */
export function parseFacts(html: string): CrawlFacts {
  const facts: CrawlFacts = {};
  const node = ldNodes(html).find((n) => [n["@type"]].flat().some((t) => typeof t === "string" && ORG.test(t)));
  if (node) {
    const hours = [node.openingHours].flat().map(str).filter(Boolean).join("\n");
    Object.assign(facts, {
      name: str(node.name),
      phone: str(node.telephone),
      email: str(node.email)?.replace(/^mailto:/i, ""),
      address: formatAddress(node.address),
      hours: hours || undefined,
    });
  }
  facts.phone ??= html.match(/href\s*=\s*["']tel:([^"']+)["']/i)?.[1]?.trim();
  facts.email ??= html.match(/href\s*=\s*["']mailto:([^"'?]+)/i)?.[1]?.trim();
  return Object.fromEntries(Object.entries(facts).filter(([, v]) => v)) as CrawlFacts;
}

function toImportError(e: unknown): ImportError {
  if (e instanceof SafeFetchError) return new ImportError(e.code === "blocked" ? "blocked" : "unreachable");
  return new ImportError(e instanceof Error && e.message === "invalid" ? "invalid" : "unreachable");
}

/** Read a company site: the homepage plus up to four About/Services/Contact-style pages. */
export async function crawlSite(rawUrl: string): Promise<CrawlResult> {
  const signal = AbortSignal.timeout(CRAWL_BUDGET_MS);
  let home: { url: string; html: string };
  try {
    home = await safeFetchHtml(rawUrl, { signal });
  } catch (e) {
    throw toImportError(e);
  }
  const rest = await Promise.allSettled(rankLinks(home.url, home.html).map((u) => safeFetchHtml(u, { signal })));
  const fetched = [home, ...rest.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []))];

  const pages = fetched.map((p) => ({ url: p.url, text: htmlToText(p.html).slice(0, PAGE_CHARS) }));
  if (pages.reduce((n, p) => n + p.text.length, 0) < MIN_TEXT) throw new ImportError("empty");

  // Earlier pages win, so the homepage's facts beat a footer on a deep page.
  const facts = fetched.reduceRight<CrawlFacts>((acc, p) => ({ ...acc, ...parseFacts(p.html) }), {});
  return { pages, facts };
}
