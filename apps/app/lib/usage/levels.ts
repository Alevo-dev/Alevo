import type { UsageMetric } from "@alevo/db";

/**
 * Pure plan-limit arithmetic (no I/O), shared by the metering gates, the shell
 * banner and the tests. Policy (plan.md §6): warn at 80%, pause at 100%,
 * nothing billed automatically.
 */

export const WARN_AT = 0.8;
export const PRICING_URL = "https://getalevo.com/pricing";

export type UsageLevel = "ok" | "warning" | "exceeded";

export const METRIC_LABEL: Record<UsageMetric, string> = {
  inbound_conversations: "AI conversations",
  voice_minutes: "Voice minutes",
  outbound_dials: "Outbound dials",
  sourced_leads: "Sourced leads",
  prospecting_emails: "Prospecting emails",
};

/** Where a count sits against its allowance. An allowance of 0 means not metered → "ok". */
export function usageLevel(used: number, allowance: number): UsageLevel {
  if (allowance <= 0) return "ok";
  if (used >= allowance) return "exceeded";
  if (used >= Math.ceil(allowance * WARN_AT)) return "warning";
  return "ok";
}

/**
 * Which threshold an increment from `before` to `after` crossed, if any. Each
 * threshold fires once per period because only the crossing increment sees it.
 */
export function crossedThreshold(before: number, after: number, allowance: number): UsageLevel | null {
  if (allowance <= 0 || after <= before) return null;
  const warn = Math.ceil(allowance * WARN_AT);
  if (before < allowance && after >= allowance) return "exceeded";
  if (before < warn && after >= warn) return "warning";
  return null;
}

export function pct(used: number, allowance: number): number {
  return allowance > 0 ? Math.min(100, Math.round((used / allowance) * 100)) : 0;
}
