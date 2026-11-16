/**
 * Pure helpers for the Meetings page figures (boards: KPI tile + "▲ 6 vs prior
 * 30 days"). No I/O, so `tests/meetings-figures.test.ts` covers it.
 */

/** Which way is good news for a figure: more booked is, more no-shows is not. */
export type Good = "up" | "down";

/**
 * "▲ 6 vs prior 30 days" for a figure that moved, "— No change"
 * for one that did not. `favourable` says whether the move is good news, so the
 * page can show a good move in success ink and keep a bad one neutral.
 */
export function deltaView(now: number, prior: number, good: Good, versus: string) {
  const diff = now - prior;
  if (diff === 0) return { text: "— No change", favourable: false };
  const up = diff > 0;
  return { text: `${up ? "▲" : "▼"} ${Math.abs(diff)} ${versus}`, favourable: up === (good === "up") };
}

/** "vs prior 30 days" / "vs yesterday". */
export function priorLabel(days: number): string {
  return days === 1 ? "vs yesterday" : `vs prior ${days} days`;
}
