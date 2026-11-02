import { orgProfiles } from "../schema/org-profiles";
import { withService } from "../with-tenant";

/** Checklist items that can be marked "Not using this" instead of being connected. */
export const DECLINE_KEYS = ["booking", "phone", "slack"] as const;
export type DeclineKey = (typeof DECLINE_KEYS)[number];
export const isDeclineKey = (value: unknown): value is DeclineKey => (DECLINE_KEYS as readonly unknown[]).includes(value);

const COLUMN = { booking: "bookingDeclined", phone: "phoneDeclined", slack: "slackDeclined" } as const;

/**
 * "Not using this" for booking / phone / Slack on the setup checklists. Upserts, because
 * a console-created workspace has no org_profiles row until a Workspace page is
 * saved. Callers authorize (requireRole / requirePlatformAdmin) and audit.
 */
export async function setSetupDecline(orgId: string, key: DeclineKey, value: boolean): Promise<void> {
  const set = { [COLUMN[key]]: value };
  await withService((tx) =>
    tx
      .insert(orgProfiles)
      .values({ orgId, ...set })
      .onConflictDoUpdate({ target: orgProfiles.orgId, set: { ...set, updatedAt: new Date() } }),
  );
}
