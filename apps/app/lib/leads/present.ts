/** Pure helpers for presenting the public contact form: no DB, safe anywhere. */

/** `tel:` href: digits and a leading +, so "(614) 555-0100 ext 2" still dials. */
export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

/** A readable text colour (white or navy) for a hex fill, by relative luminance. */
export function onAccent(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const lin = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const x = c / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  });
  const lum = 0.2126 * lin[0]! + 0.7152 * lin[1]! + 0.0722 * lin[2]!;
  return lum > 0.18 ? "#06091a" : "#ffffff";
}

/** `?accent=` on the hosted page: a six-digit hex, with or without the #. Anything else is ignored. */
export function parseAccent(raw: string | undefined): string | undefined {
  const v = raw?.trim().replace(/^#/, "") ?? "";
  return /^[0-9a-f]{6}$/i.test(v) ? `#${v.toLowerCase()}` : undefined;
}
