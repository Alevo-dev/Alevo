/** Pure colour helpers for the brand colour picker and its validation (no DB, safe anywhere). */

export type Hsv = { h: number; s: number; v: number };

/** "#rrggbb", lowercase, from "#rrggbb", "rrggbb", "#rgb" or "rgb" (any case, surrounding spaces ignored); null for anything else. */
export function normaliseHex(raw: string): string | null {
  const v = raw.trim().replace(/^#/, "").toLowerCase();
  if (/^[0-9a-f]{3}$/.test(v)) return `#${v[0]}${v[0]}${v[1]}${v[1]}${v[2]}${v[2]}`;
  return /^[0-9a-f]{6}$/.test(v) ? `#${v}` : null;
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** Hue 0-360, saturation and brightness 0-1, from a valid "#rrggbb". */
export function hexToHsv(hex: string): Hsv {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  let h = 0;
  if (d !== 0) {
    if (max === r) h = 60 * (((g - b) / d) % 6);
    else if (max === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
    if (h < 0) h += 360;
  }
  return { h, s: max === 0 ? 0 : d / max, v: max };
}

/** "#rrggbb" from hue (any number, wrapped to 0-360), saturation and brightness (clamped to 0-1). */
export function hsvToHex({ h, s, v }: Hsv): string {
  const sat = clamp01(s);
  const val = clamp01(v);
  const hue = ((h % 360) + 360) % 360;
  const c = val * sat;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = val - c;
  const [r, g, b] =
    hue < 60 ? [c, x, 0] : hue < 120 ? [x, c, 0] : hue < 180 ? [0, c, x] : hue < 240 ? [0, x, c] : hue < 300 ? [x, 0, c] : [c, 0, x];
  const to = (f: number) => Math.round((f + m) * 255).toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

/** Relative luminance (WCAG) of a valid "#rrggbb". */
function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const [r = 0, g = 0, b = 0] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const x = c / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * The text colour public/chat.js puts on an accent when `data-color` is not set: white, unless the accent
 * is too light for it (under about 3:1), then navy. Kept in step with chat.js so the install snippet can
 * show the real default.
 */
export function chatTextColour(accent: string): "#ffffff" | "#06091a" {
  return luminance(accent) <= 0.3 ? "#ffffff" : "#06091a";
}

/** WCAG contrast ratio (1 to 21) between two valid "#rrggbb" colours, in either order. */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}
