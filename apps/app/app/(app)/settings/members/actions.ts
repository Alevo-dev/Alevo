"use server";

import { revalidatePath } from "next/cache";
import { and, count, eq, ne } from "drizzle-orm";
import {
  memberships,
  orgInvitations,
  recordAudit,
  withService,
  type AppRole,
} from "@alevo/db";
import {
  getCurrentOrg,
  getCurrentUser,
  inviteToActiveOrg,
  removeFromActiveOrg,
  requireRole,
  revokeActiveOrgInvitation,
  setActiveOrgMemberRole,
} from "@alevo/auth";

export type ActionState = {
  ok?: boolean;
  error?: string; // form-level (non-field) error
  errors?: { email?: string }; // per-field errors
  /** Echoed back so the invite form keeps its values on error (rule 13). */
  values?: { email?: string; role?: AppRole };
};

const ROLES: readonly AppRole[] = ["viewer", "rep", "admin", "owner"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseRole(value: FormDataEntryValue | null): AppRole {
  if (typeof value === "string" && (ROLES as readonly string[]).includes(value)) {
    return value as AppRole;
  }
  throw new Error("Invalid role");
}

/** requireRole('admin') + resolve the active org and the acting user's id. */
async function adminContext() {
  await requireRole("admin");
  const [org, me] = await Promise.all([getCurrentOrg(), getCurrentUser()]);
  if (!org) throw new Error("No active organization");
  return { org, actorId: me?.id ?? null };
}

function fail(error: unknown): ActionState {
  return { error: error instanceof Error ? error.message : "Something went wrong" };
}

export async function inviteMember(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const emailRaw = String(formData.get("email") ?? "").trim();
  const roleStr = String(formData.get("role") ?? "");
  const values = {
    email: emailRaw,
    role: (ROLES as readonly string[]).includes(roleStr) ? (roleStr as AppRole) : "rep",
  };
  const emailError = !emailRaw
    ? "Email is required."
    : !EMAIL_RE.test(emailRaw)
      ? "Enter a valid email address."
      : undefined;
  if (emailError) return { errors: { email: emailError }, values };

  try {
    const { org, actorId } = await adminContext();
    const email = emailRaw.toLowerCase();
    const role = parseRole(formData.get("role"));
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
          invitedBy: actorId,
        })
        .onConflictDoUpdate({
          target: orgInvitations.clerkInvitationId,
          set: { role, status: "pending", updatedAt: new Date() },
        }),
    );
    await recordAudit({
      orgId: org.id,
      actorUserId: actorId,
      action: "invite.created",
      target: email,
      metadata: { role },
    });
    revalidatePath("/settings/members");
    return { ok: true };
  } catch (error) {
    return { ...fail(error), values };
  }
}

export async function changeMemberRole(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const { org, actorId } = await adminContext();
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
    await recordAudit({
      orgId: org.id,
      actorUserId: actorId,
      action: "member.role_changed",
      target: userId,
      metadata: { role: newRole },
    });
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
    const { org, actorId } = await adminContext();
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
    await recordAudit({
      orgId: org.id,
      actorUserId: actorId,
      action: "member.removed",
      target: userId,
    });
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
    const { org, actorId } = await adminContext();
    const clerkInvitationId = String(formData.get("clerkInvitationId") ?? "");
    if (!clerkInvitationId) return { error: "Missing invitation" };

    await revokeActiveOrgInvitation(clerkInvitationId);
    await withService((tx) =>
      tx
        .update(orgInvitations)
        .set({ status: "revoked", updatedAt: new Date() })
        .where(eq(orgInvitations.clerkInvitationId, clerkInvitationId)),
    );
    await recordAudit({
      orgId: org.id,
      actorUserId: actorId,
      action: "invite.revoked",
      target: clerkInvitationId,
    });
    revalidatePath("/settings/members");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}
