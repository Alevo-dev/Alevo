import "server-only";
import { withOrg } from "./session";

/**
 * The caller's active organization row from OUR database, or null. Under
 * `withOrg`, RLS restricts `organizations` to the current org, so a plain
 * `findFirst` returns exactly that tenant's row.
 */
export async function getCurrentOrg() {
  return withOrg(async (tx) => {
    const org = await tx.query.organizations.findFirst();
    return org ?? null;
  });
}
