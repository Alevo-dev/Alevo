import { isIP } from "node:net";
import { lookup } from "node:dns/promises";

/**
 * Fetch for URLs a user typed in (KB "add URL", website import). A plain fetch
 * would let anyone point our servers at localhost, a private network or the cloud
 * metadata address, so every host is resolved and checked first, and again on
 * each redirect. Not for vendor APIs: those use vendorFetch.
 */
export class SafeFetchError extends Error {
  constructor(
    public code: "blocked" | "unreachable" | "not_html" | "too_large",
    message?: string,
  ) {
    super(message ?? DEFAULT_MESSAGE[code]);
  }
}

// Shown as-is where a failed KB source is listed, so keep them readable.
const DEFAULT_MESSAGE = {
  blocked: "That address is not allowed",
  unreachable: "Could not reach that page",
  not_html: "That link is not a web page",
  too_large: "That page is too large to read",
} as const;

function blockedV4(a: number, b: number): boolean {
  return (
    a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19))
  );
}

/** IPv6 text to eight 16-bit groups; null when malformed. Handles `::` and a trailing dotted quad. */
function groupsV6(ip: string): number[] | null {
  let s = ip.toLowerCase();
  const quad = s.match(/(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (quad) {
    const [, a = 0, b = 0, c = 0, d = 0] = quad.map(Number);
    s = s.slice(0, quad.index) + ((a << 8) | b).toString(16) + ":" + ((c << 8) | d).toString(16);
  }
  const [head, tail, ...extra] = s.split("::");
  if (extra.length) return null;
  const h = head ? head.split(":") : [];
  const t = tail === undefined ? [] : tail ? tail.split(":") : [];
  const fill = tail === undefined ? 0 : 8 - h.length - t.length;
  if (fill < 0 || (tail === undefined && h.length !== 8)) return null;
  const parts = [...h, ...Array(fill).fill("0"), ...t].map((p) => parseInt(p, 16));
  return parts.length === 8 && parts.every((n) => n >= 0 && n <= 0xffff) ? parts : null;
}

/** True for any address a public website cannot legitimately have. Fails closed on junk. */
export function isBlockedIp(ip: string): boolean {
  const kind = isIP(ip);
  if (kind === 4) {
    const [a = 0, b = 0] = ip.split(".").map(Number);
    return blockedV4(a, b);
  }
  if (kind !== 6) return true;
  const g = groupsV6(ip);
  if (!g) return true;
  const [g0 = 0, g1 = 0, , , , g5 = 0, g6 = 0, g7 = 0] = g;
  const v4 = (hi: number) => blockedV4(hi >> 8, hi & 0xff);
  if (g.slice(0, 5).every((n) => n === 0) && g5 === 0xffff) return v4(g6); // ::ffff:a.b.c.d
  if (g.slice(0, 6).every((n) => n === 0)) return g6 === 0 && g7 <= 1 ? true : v4(g6); // ::, ::1, ::a.b.c.d
  if (g0 === 0x64 && g1 === 0xff9b) return v4(g6); // NAT64
  return (g0 & 0xfe00) === 0xfc00 || (g0 & 0xffc0) === 0xfe80 || (g0 & 0xff00) === 0xff00;
}

/** Parse what a person typed: `acme.com` becomes https://acme.com. http(s) only, no credentials. */
export function normalizeUrl(raw: string): URL {
  const t = raw.trim();
  if (!t) throw new Error("invalid");
  let url: URL;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(t) ? t : `https://${t}`);
  } catch {
    throw new Error("invalid");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new SafeFetchError("blocked", "Only http(s) addresses are allowed");
  if (url.username || url.password) throw new SafeFetchError("blocked", "Addresses with a login are not allowed");
  return url;
}

/** `normalizeUrl` plus a DNS check: every address the host resolves to must be public. */
export async function assertPublicUrl(raw: string): Promise<URL> {
  const url = normalizeUrl(raw);
  const host = url.hostname.replace(/^\[|\]$/g, "");
  let addrs: string[];
  if (isIP(host)) addrs = [host];
  else {
    try {
      addrs = (await lookup(host, { all: true })).map((a) => a.address);
    } catch {
      throw new SafeFetchError("unreachable", "Host not found");
    }
  }
  if (addrs.length === 0 || addrs.some(isBlockedIp)) throw new SafeFetchError("blocked", "That address is not allowed");
  return url;
}

/** `signal` is an overall deadline shared across calls (a crawl), on top of the per-request timeout. */
type Opts = { timeoutMs?: number; maxBytes?: number; maxRedirects?: number; signal?: AbortSignal };

/** GET a page as text: redirects re-checked hop by hop, HTML/text only, body size capped. */
export async function safeFetchHtml(raw: string, opts: Opts = {}): Promise<{ url: string; html: string }> {
  const { timeoutMs = 8000, maxBytes = 1_048_576, maxRedirects = 3, signal } = opts;
  // ponytail: resolve-then-fetch; pin to the resolved IP if this ever opens to non-admins
  let url = await assertPublicUrl(raw);
  for (let hop = 0; ; hop++) {
    let res: Response;
    try {
      res = await fetch(url, {
        redirect: "manual",
        cache: "no-store",
        signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]) : AbortSignal.timeout(timeoutMs),
        headers: { "user-agent": "AlevoBot/1.0 (+https://getalevo.com)", accept: "text/html,text/plain" },
      });
    } catch {
      throw new SafeFetchError("unreachable");
    }
    const next = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && next) {
      if (hop >= maxRedirects) throw new SafeFetchError("unreachable", "Too many redirects");
      url = await assertPublicUrl(new URL(next, url).href);
      continue;
    }
    if (!res.ok) throw new SafeFetchError("unreachable", `Fetch failed (${res.status})`);
    if (!/^text\/(html|plain)|^application\/xhtml/i.test(res.headers.get("content-type") ?? "")) throw new SafeFetchError("not_html");
    return { url: url.href, html: await readCapped(res, maxBytes) };
  }
}

async function readCapped(res: Response, maxBytes: number): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new SafeFetchError("too_large");
      }
      chunks.push(value);
    }
  } catch (e) {
    if (e instanceof SafeFetchError) throw e;
    throw new SafeFetchError("unreachable");
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}
