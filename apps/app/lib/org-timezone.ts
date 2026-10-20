import { sql } from "drizzle-orm";
import { orgProfiles } from "@alevo/db";
import { withOrg } from "@alevo/auth";
import { DEFAULT_TIMEZONE, isValidTimeZone } from "@/lib/cadence/send-window";

/**
 * The active org's display timezone (Settings → Qualifier → Default timezone),
 * falling back to the app default. Server-only; scoped explicitly to the
 * current org (platform admins bypass RLS).
 */
export async function getOrgTimezone(): Promise<string> {
  const [row] = await withOrg((tx) =>
    tx
      .select({ timezone: orgProfiles.timezone })
      .from(orgProfiles)
      .where(sql`${orgProfiles.orgId} = (select app.current_org_id())`)
      .limit(1),
  );
  const tz = row?.timezone;
  return tz && isValidTimeZone(tz) ? tz : DEFAULT_TIMEZONE;
}
