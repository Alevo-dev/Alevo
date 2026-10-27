/**
 * Internal speed-to-lead watch (plan.md Sprint 5): which orgs are replying
 * slower than the target, and the Slack digest that says so. Pure; the Inngest
 * cron in `lib/inngest/functions.ts` measures and posts. Tested.
 */

/** The promise: a first reply within a minute. */
export const SPEED_TARGET_SEC = 60;
/** Fewer answered leads than this is noise, not a trend. */
export const MIN_REPLIES = 3;

export type OrgSpeed = { name: string; replied: number; p50: number | null; p95: number | null };

/** Orgs whose p95 first reply missed the target over enough leads, slowest first. */
export function slowOrgs(rows: OrgSpeed[], target = SPEED_TARGET_SEC, minReplies = MIN_REPLIES): OrgSpeed[] {
  return rows
    .filter((r) => r.replied >= minReplies && r.p95 != null && r.p95 > target)
    .sort((a, b) => (b.p95 ?? 0) - (a.p95 ?? 0));
}

function secs(v: number | null): string {
  if (v == null) return "—";
  const s = Math.round(v);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}

/** One Slack message for the slow orgs; null when there is nothing to say. */
export function speedDigest(slow: OrgSpeed[], windowLabel = "last 24 hours"): string | null {
  if (slow.length === 0) return null;
  const lines = slow.map((r) => `• ${r.name}: p95 ${secs(r.p95)}, median ${secs(r.p50)} over ${r.replied} answered leads`);
  return [`Speed to lead over target (${SPEED_TARGET_SEC}s) — ${windowLabel}`, ...lines].join("\n");
}
