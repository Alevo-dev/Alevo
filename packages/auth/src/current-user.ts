import "server-only";
import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { users, withService } from "@alevo/db";

/**
 * The signed-in user's row from OUR database (resolved by Clerk id), or null if
 * not signed in / not yet mirrored by the webhook.
 *
 * Uses the service path because it runs before an org is necessarily active
 * (RLS needs an org to scope by). This is safe: it only ever reads the caller's
 * OWN row, keyed by their verified Clerk id.
 */
export async function getCurrentUser() {
  const { userId } = await auth();
  if (!userId) return null;
  const row = await withService((tx) =>
    tx.query.users.findFirst({ where: eq(users.clerkId, userId) }),
  );
  return row ?? null;
}
