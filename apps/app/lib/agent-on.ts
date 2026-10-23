import { cache } from "react";
import { sql } from "drizzle-orm";
import { orgProfiles } from "@alevo/db";
import { withOrg } from "@alevo/auth";

/** Whether the active org's agent is switched on (`org_profiles.enabled`).
 *  Cached per request so the shell and a page can both ask without a second query.
 *  Explicitly scoped to the current org — platform admins bypass RLS. */
export const getAgentOn = cache(async (): Promise<boolean> => {
  const [row] = await withOrg((tx) =>
    tx
      .select({ enabled: orgProfiles.enabled })
      .from(orgProfiles)
      .where(sql`${orgProfiles.orgId} = (select app.current_org_id())`)
      .limit(1),
  );
  return row?.enabled ?? false;
});
