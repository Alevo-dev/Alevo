"use server";

import { and, count, eq, sql } from "drizzle-orm";
import {
  memberships,
  organizations,
  orgInvitations,
  recordAudit,
  users,
  withService,
  type AppRole,
} from "@alevo/db";
import {
  deleteActiveOrg,
  getCurrentOrg,
  getCurrentUser,
  leaveActiveOrg,
  requireRole,
  withOrg,
} from "@alevo/auth";

/** A member row for the Manage → Members tab (mirrors the old members page). */
export type MemberView = {
  userId: string;
  clerkUserId: string;
  email: string | null;
  name: string | null;
  role: AppRole;
  joinedAt: string; // ISO
};

export type InviteView = {
  id: string;
  email: string;
  role: AppRole;
  clerkInvitationId: string | null;
};

export type MembersResult = { members: MemberView[]; pending: InviteView[] } | { error: string };
export type OrgActionResult = { ok?: boolean; error?: string };

function fail(error: unknown): { error: string } {
  return { error: error instanceof Error ? error.message : "Something went wrong" };
}

/**
 * Load the active org's members + pending invites for the Manage dialog.
 * Admin-only. Both reads are scoped explicitly to the active org (a platform
 * admin bypasses RLS, so RLS is the backstop, not the selector).
 */
export async function loadMembers(): Promise<MembersResult> {
  try {
    await requireRole("admin");
    const inActiveOrg = (col: typeof memberships.orgId | typeof orgInvitations.orgId) =>
      sql`${col} = (select app.current_org_id())`;

    const [rows, invites] = await Promise.all([
      withOrg((tx) =>
        tx
          .select({
            userId: users.id,
            clerkUserId: users.clerkId,
            email: users.email,
            firstName: users.firstName,
            lastName: users.lastName,
            role: memberships.role,
            joinedAt: memberships.createdAt,
          })
          .from(memberships)
          .innerJoin(users, eq(users.id, memberships.userId))
          .where(inActiveOrg(memberships.orgId)),
      ),
      withOrg((tx) =>
        tx
          .select({
            id: orgInvitations.id,
            email: orgInvitations.email,
            role: orgInvitations.role,
            clerkInvitationId: orgInvitations.clerkInvitationId,
          })
          .from(orgInvitations)
          .where(and(eq(orgInvitations.status, "pending"), inActiveOrg(orgInvitations.orgId))),
      ),
    ]);

    return {
      members: rows.map((r) => ({
        userId: r.userId,
        clerkUserId: r.clerkUserId,
        email: r.email,
        name: [r.firstName, r.lastName].filter(Boolean).join(" ") || null,
        role: r.role,
        joinedAt: (r.joinedAt instanceof Date ? r.joinedAt : new Date(r.joinedAt)).toISOString(),
      })),
      pending: invites,
    };
  } catch (error) {
    return fail(error);
  }
}

/** The caller leaves the active workspace. A sole owner is blocked. */
export async function leaveOrg(): Promise<OrgActionResult> {
  try {
    await requireRole("viewer"); // any member may leave
    const [org, me] = await Promise.all([getCurrentOrg(), getCurrentUser()]);
    if (!org || !me) return { error: "No active organization" };

    const [mine] = await withService((tx) =>
      tx
        .select({ role: memberships.role })
        .from(memberships)
        .where(and(eq(memberships.orgId, org.id), eq(memberships.userId, me.id)))
        .limit(1),
    );
    if (mine?.role === "owner") {
      const [owners] = await withService((tx) =>
        tx
          .select({ n: count() })
          .from(memberships)
          .where(and(eq(memberships.orgId, org.id), eq(memberships.role, "owner"))),
      );
      if (!owners || owners.n <= 1) {
        return { error: "You're the only owner. Transfer ownership or delete the workspace instead." };
      }
    }

    await leaveActiveOrg();
    await withService((tx) =>
      tx.delete(memberships).where(and(eq(memberships.orgId, org.id), eq(memberships.userId, me.id))),
    );
    await recordAudit({ orgId: org.id, actorUserId: me.id, action: "member.left", target: me.id });
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

/** Delete the active workspace (owner-only). Removes it in Clerk + our DB. */
export async function deleteOrg(): Promise<OrgActionResult> {
  try {
    await requireRole("owner");
    const org = await getCurrentOrg();
    if (!org) return { error: "No active organization" };

    await deleteActiveOrg();
    // Deleting the org row cascades to every tenant table (FK onDelete cascade),
    // so no orphaned rows even though the `organization.deleted` webhook is a no-op.
    await withService((tx) => tx.delete(organizations).where(eq(organizations.id, org.id)));
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}
