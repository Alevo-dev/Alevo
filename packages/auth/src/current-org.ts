import "server-only";
import { sql } from "drizzle-orm";
import { organizations } from "@alevo/db";
import { withOrg } from "./session";

/**
 * The caller's active organization row from OUR database, or null.
 *
 * Filters EXPLICITLY on the active org id — never relies on RLS to return a
 * single row. A platform admin can read every org (RLS allows it for the assist
 * view), so an unfiltered `findFirst` would return an arbitrary org. Scope to
 * `app.current_org_id()` so switching orgs always resolves the right one.
 */
export async function getCurrentOrg() {
  return withOrg(async (tx) => {
    const [org] = await tx
      .select()
      .from(organizations)
      .where(sql`${organizations.id} = (select app.current_org_id())`)
      .limit(1);
    return org ?? null;
  });
}
