import * as Sentry from "@sentry/nextjs";
import { and, eq, inArray } from "drizzle-orm";
import { getUsage, memberships, recordUsage, users, withService, type UsageMetric, type UsageRow } from "@alevo/db";
import { sendPlatformEmail } from "@/lib/email/resend";
import { notifySlack } from "@/lib/notifications/slack";

/**
 * Plan limits, the agreed way (plan.md §6): nothing is billed automatically.
 *  - at 80% of an allowance the owners get a heads-up (Slack + email)
 *  - at 100% the metered activity PAUSES (new conversations aren't worked, calls
 *    aren't answered) and the owners are asked to upgrade
 * Opt-in overage with a monthly cap lands with Stripe; the gates below are the
 * only behaviour until then.
 */

import { crossedThreshold, METRIC_LABEL, PRICING_URL, pct, usageLevel, type UsageLevel } from "./levels";

export * from "./levels";

/** True when the metric is at or past its allowance → the activity is paused. */
export async function overAllowance(orgId: string, metric: UsageMetric): Promise<boolean> {
  const row = (await getUsage(orgId)).find((r) => r.metric === metric);
  return row ? usageLevel(row.used, row.allowance) === "exceeded" : false;
}

/**
 * Record usage and alert the owners when this increment crosses 80% or 100%.
 * Replaces direct `recordUsage` calls; the alert is best-effort and never fails
 * the caller.
 */
export async function meterUsage(orgId: string, metric: UsageMetric, delta = 1): Promise<void> {
  const after = await recordUsage(orgId, metric, delta);
  try {
    const row = (await getUsage(orgId)).find((r) => r.metric === metric);
    if (!row) return;
    const level = crossedThreshold(after - delta, after, row.allowance);
    if (level) await alertOwners(orgId, { ...row, used: after }, level);
  } catch (err) {
    Sentry.captureException(err);
  }
}

async function ownerEmails(orgId: string): Promise<string[]> {
  const rows = await withService((tx) =>
    tx
      .select({ email: users.email })
      .from(memberships)
      .innerJoin(users, eq(users.id, memberships.userId))
      .where(and(eq(memberships.orgId, orgId), inArray(memberships.role, ["owner", "admin"]))),
  );
  return rows.map((r) => r.email).filter((e): e is string => Boolean(e));
}

async function alertOwners(orgId: string, row: UsageRow, level: UsageLevel) {
  const label = METRIC_LABEL[row.metric];
  const line = `${label}: ${row.used} of ${row.allowance} used this month (${pct(row.used, row.allowance)}%).`;
  const consequence =
    level === "exceeded"
      ? "The agent has paused this activity until the next period or an upgrade. Nothing is billed automatically."
      : "At the limit the agent pauses this activity. Nothing is billed automatically.";
  const subject = level === "exceeded" ? `${label} limit reached` : `${label}: 80% of your plan used`;
  const body = `${line}\n\n${consequence}\n\nUpgrade or compare plans: ${PRICING_URL}`;

  await Promise.all([
    notifySlack(orgId, `${level === "exceeded" ? "Plan limit reached" : "Plan limit approaching"} — ${line} ${consequence}`),
    ownerEmails(orgId).then((to) => sendPlatformEmail({ to, subject: `Alevo — ${subject}`, body })),
  ]);
}
