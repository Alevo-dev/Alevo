import { isBlockedIp, normalizeUrl } from "../http/safe-fetch";

export const WEBSITE_MAX = 200;

/**
 * The company website as it is stored: https only (a typed `http://` is upgraded,
 * a bare `acme.com` gets the scheme), a real public-looking host, no login in the
 * address, no query or fragment. Blank is fine (the field is optional).
 */
export function cleanWebsite(raw: string): { value: string | null; error?: string } {
  const t = raw.trim();
  if (!t) return { value: null };
  const bad = { value: null, error: "Enter a website address like yourcompany.com." };
  let url: URL;
  try {
    url = normalizeUrl(t);
  } catch {
    return bad;
  }
  const host = url.hostname.replace(/^\[|\]$/g, "");
  // A name with a dot (not localhost / intranet), or a public IP; never a private one.
  if (!host.includes(".") && !host.includes(":")) return bad;
  if (/^[\d.]+$|:/.test(host) && isBlockedIp(host)) return bad;
  const path = url.pathname === "/" ? "" : url.pathname.replace(/\/$/, "");
  const value = `https://${url.host}${path}`;
  if (value.length > WEBSITE_MAX) return { value: null, error: `Keep it under ${WEBSITE_MAX} characters.` };
  return { value };
}
