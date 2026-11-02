import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { memberships, organizations, withService } from "@alevo/db";
import { authInterrupt, requirePlatformAdmin } from "@alevo/auth";
import { allowedDestination } from "@/lib/admin/destination";
import { OpenOrg } from "./open-org";

export const dynamic = "force-dynamic";

const ADMIN_URL = (process.env.NEXT_PUBLIC_ADMIN_URL ?? "https://admin.getalevo.com").replace(/\/$/, "");

/**
 * Deep link from the admin console: `/admin/open?org=<clerkOrgId>&to=/workspace/…`.
 * A platform admin who is a member of that org gets it made active (client-side
 * Clerk call) and lands on `to`; one who is not is sent back to the console's org
 * page to join as support first.
 */
export default async function OpenPage({ searchParams }: { searchParams: Promise<{ org?: string; to?: string }> }) {
  const { org: clerkOrgId, to } = await searchParams;
  let me: Awaited<ReturnType<typeof requirePlatformAdmin>>;
  try {
    me = await requirePlatformAdmin();
  } catch (error) {
    authInterrupt(error);
  }
  if (!clerkOrgId) notFound();

  const [row] = await withService((tx) =>
    tx
      .select({ orgId: organizations.id, membershipId: memberships.id })
      .from(organizations)
      .leftJoin(memberships, and(eq(memberships.orgId, organizations.id), eq(memberships.userId, me.id)))
      .where(eq(organizations.clerkId, clerkOrgId))
      .limit(1),
  );
  if (!row) notFound();
  if (!row.membershipId) redirect(`${ADMIN_URL}/organizations/${row.orgId}?notice=join-first`);

  return <OpenOrg clerkOrgId={clerkOrgId} to={allowedDestination(to)} />;
}
