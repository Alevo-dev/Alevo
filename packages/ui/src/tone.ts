/**
 * Colour tone for status UI (pills, dots). Design system: brand = live / in
 * progress, success = done, warning = needs a human, danger = failed, muted =
 * closed / not a fit. Violet is reserved for outbound / AI-drafted things.
 */
export type Tone = "brand" | "violet" | "success" | "warning" | "danger" | "muted";
export type StatusView = { label: string; tone: Tone };
