"use server";

import { revalidatePath } from "next/cache";
import { and, count, eq, ne } from "drizzle-orm";
import { memberships, orgInvitations, withService, type AppRole } from "@alevo/db";
import {
  getCurrentOrg,
  getCurrentUser,
  inviteToActiveOrg,
  removeFromActiveOrg,
  requireRole,
  revokeActiveOrgInvitation,
  setActiveOrgMemberRole,
} from "@alevo/auth";

export type ActionState = { ok?: boolean; error?: string };

const ROLES: readonly AppRole[] = ["viewer", "rep", "admin", "owner"];

function parseRole(value: FormDataEntryValue | null): AppRole {
  if (typeof value === "string" && (ROLES as readonly string[]).includes(value)) {
    return value as AppRole;
  }
  throw new Error("Invalid role");
}

/** requireRole('admin') + resolve the active org's row (its uuid). */
async function adminOrg() {
  await requireRole("admin");
  const org = await getCurrentOrg();
  if (!org) throw new Error("No active organization");
  return org;
}

function fail(error: unknown): ActionState {
  return { error: error instanceof Error ? error.message : "Something went wrong" };
}

export async function inviteMember(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const org = await adminOrg();
    const me = await getCurrentUser();
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const role = parseRole(formData.get("role"));
    if (!email) return { error: "Email is required" };
    if (role === "owner") await requireRole("owner"); // only owners grant owner

    const { clerkInvitationId } = await inviteToActiveOrg({ email, role });
    await withService((tx) =>
      tx
        .insert(orgInvitations)
        .values({
          orgId: org.id,
          email,
          role,
          status: "pending",
          clerkInvitationId,
          invitedBy: me?.id ?? null,
        })
        .onConflictDoUpdate({
          target: orgInvitations.clerkInvitationId,
          set: { role, status: "pending", updatedAt: new Date() },
        }),
    );
    revalidatePath("/settings/members");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function changeMemberRole(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const org = await adminOrg();
    const userId = String(formData.get("userId") ?? "");
    const clerkUserId = String(formData.get("clerkUserId") ?? "");
    const newRole = parseRole(formData.get("role"));
    if (!userId || !clerkUserId) return { error: "Missing member" };

    const [current] = await withService((tx) =>
      tx
        .select({ role: memberships.role })
        .from(memberships)
        .where(and(eq(memberships.orgId, org.id), eq(memberships.userId, userId)))
        .limit(1),
    );
    if (!current) return { error: "Member not found" };

    // Touching an owner (either direction) requires owner.
    if (current.role === "owner" || newRole === "owner") await requireRole("owner");
    // Never demote the last owner.
    if (current.role === "owner" && newRole !== "owner") {
      const [owners] = await withService((tx) =>
        tx
          .select({ n: count() })
          .from(memberships)
          .where(
            and(
              eq(memberships.orgId, org.id),
              eq(memberships.role, "owner"),
              ne(memberships.userId, userId),
            ),
          ),
      );
      if (!owners || owners.n === 0) return { error: "Cannot demote the last owner" };
    }

    await withService((tx) =>
      tx
        .update(memberships)
        .set({ role: newRole, updatedAt: new Date() })
        .where(and(eq(memberships.orgId, org.id), eq(memberships.userId, userId))),
    );
    await setActiveOrgMemberRole(clerkUserId, newRole);
    revalidatePath("/settings/members");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function removeMember(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const org = await adminOrg();
    const userId = String(formData.get("userId") ?? "");
    const clerkUserId = String(formData.get("clerkUserId") ?? "");
    if (!userId || !clerkUserId) return { error: "Missing member" };

    const [current] = await withService((tx) =>
      tx
        .select({ role: memberships.role })
        .from(memberships)
        .where(and(eq(memberships.orgId, org.id), eq(memberships.userId, userId)))
        .limit(1),
    );
    if (!current) return { error: "Member not found" };
    if (current.role === "owner") {
      await requireRole("owner");
      const [owners] = await withService((tx) =>
        tx
          .select({ n: count() })
          .from(memberships)
          .where(and(eq(memberships.orgId, org.id), eq(memberships.role, "owner"))),
      );
      if (!owners || owners.n <= 1) return { error: "Cannot remove the last owner" };
    }

    // Remove in Clerk (revokes their access); our webhook mirrors the deletion,
    // but delete locally too so the UI updates immediately.
    await removeFromActiveOrg(clerkUserId);
    await withService((tx) =>
      tx
        .delete(memberships)
        .where(and(eq(memberships.orgId, org.id), eq(memberships.userId, userId))),
    );
    revalidatePath("/settings/members");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function revokeInvite(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await adminOrg();
    const clerkInvitationId = String(formData.get("clerkInvitationId") ?? "");
    if (!clerkInvitationId) return { error: "Missing invitation" };

    await revokeActiveOrgInvitation(clerkInvitationId);
    await withService((tx) =>
      tx
        .update(orgInvitations)
        .set({ status: "revoked", updatedAt: new Date() })
        .where(eq(orgInvitations.clerkInvitationId, clerkInvitationId)),
    );
    revalidatePath("/settings/members");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}
