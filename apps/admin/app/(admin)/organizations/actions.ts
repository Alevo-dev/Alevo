"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { isDeclineKey, memberships, orgInvitations, organizations, recordAudit, setSetupDecline, withService } from "@alevo/db";
import { addMemberToOrg, ClerkRejectedError, createOrganizationAs, inviteToOrg, removeFromOrg, requirePlatformAdmin, revokeOrgInvitation } from "@alevo/auth";
import { activePlans } from "@/lib/plans";
import { setOrgPlan } from "@/lib/subscriptions";

export type NewOrgState = {
  ok?: boolean;
  error?: string;
  /** Created, but something after creation needs a look (the invite failed, or the mirror is slow). */
  notice?: string;
  errors?: { name?: string; email?: string };
  values?: { name: string; email: string; planId: string };
  orgId?: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function message(error: unknown): string {
  return (error instanceof Error && error.message) || "Something went wrong";
}

/**
 * Mirror the org row ourselves instead of waiting for the webhook: same
 * `clerk_id` key the mirror upserts on, so whichever lands first, there is one
 * row — and the plan + invitation writes below never race a missing org.
 */
async function ensureOrgRow(clerkOrgId: string, name: string): Promise<{ id: string }> {
  return withService(async (tx) => {
    await tx.insert(organizations).values({ clerkId: clerkOrgId, name }).onConflictDoNothing();
    const [org] = await tx.select({ id: organizations.id }).from(organizations).where(eq(organizations.clerkId, clerkOrgId)).limit(1);
    if (!org) throw new Error("Could not record the workspace");
    return org;
  });
}

/**
 * Admin → Organizations → New organization: create the Clerk org (the admin
 * becomes its first member — flagged Alevo support by the webhook mirror),
 * invite the owner, put it on the chosen plan. Rule 13: per-field errors.
 */
export async function createOrganization(_prev: NewOrgState, formData: FormData): Promise<NewOrgState> {
  const values = {
    name: String(formData.get("name") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    planId: String(formData.get("planId") ?? ""),
  };
  const errors: NewOrgState["errors"] = {};
  if (!values.name) errors.name = "Give the workspace a name.";
  else if (values.name.length > 100) errors.name = "Keep the name under 100 characters.";
  if (!values.email) errors.email = "Enter the owner's email.";
  else if (!EMAIL_RE.test(values.email)) errors.email = "Enter a valid email address.";
  if (errors.name || errors.email) return { errors, values };

  let me: Awaited<ReturnType<typeof requirePlatformAdmin>>;
  let clerkOrgId: string;
  try {
    me = await requirePlatformAdmin();
    const plan = (await activePlans()).find((p) => p.id === values.planId);
    if (!plan) return { error: "Pick a plan.", values };
    ({ clerkOrgId } = await createOrganizationAs({ name: values.name, createdByClerkUserId: me.clerkId }));
  } catch (error) {
    // Clerk's reason goes under the field it names (rule 13).
    if (error instanceof ClerkRejectedError && (error.param === "name" || error.param === "slug")) return { errors: { name: error.message }, values };
    return { error: message(error), values };
  }

  // From here the org exists in Clerk: report problems, never pretend it failed.
  let clerkInvitationId: string | null = null;
  let notice: string | undefined;
  try {
    ({ clerkInvitationId } = await inviteToOrg({ clerkOrgId, email: values.email, role: "owner", inviterClerkUserId: me.clerkId }));
  } catch (error) {
    notice = `Workspace created, but the owner invite failed: ${message(error)}. Resend it from the organization page.`;
  }

  const org = await ensureOrgRow(clerkOrgId, values.name);
  await setOrgPlan(org.id, values.planId);
  if (clerkInvitationId) {
    await recordInvitation(org.id, values.email, clerkInvitationId, me.id);
    await recordAudit({ orgId: org.id, actorUserId: me.id, action: "invite.created", target: values.email, metadata: { role: "owner" } });
  }
  await recordAudit({ orgId: org.id, actorUserId: me.id, action: "org.created_by_admin", metadata: { ownerEmail: values.email, planId: values.planId } });
  revalidatePath("/organizations");
  if (notice) return { ok: true, notice, orgId: org.id };
  redirect(`/organizations/${org.id}`);
}

/** Our row for an owner invite; the webhook may have mirrored it first, so update on the Clerk id (keeps `invitedBy`). */
async function recordInvitation(orgId: string, email: string, clerkInvitationId: string, invitedBy: string): Promise<void> {
  await withService((tx) =>
    tx
      .insert(orgInvitations)
      .values({ orgId, email, role: "owner", status: "pending", clerkInvitationId, invitedBy })
      .onConflictDoUpdate({ target: orgInvitations.clerkInvitationId, set: { role: "owner", status: "pending", invitedBy, updatedAt: new Date() } }),
  );
}

// ── Org page actions ─────────────────────────────────────────────────────────

export type OrgActionState = { ok?: boolean; error?: string };

type OrgAction = (me: Awaited<ReturnType<typeof requirePlatformAdmin>>, org: { id: string; clerkId: string }, formData: FormData) => Promise<void>;

/** requirePlatformAdmin + resolve the org from the hidden `orgId` field, then run; errors become `{ error }`. */
async function orgAction(formData: FormData, run: OrgAction): Promise<OrgActionState> {
  try {
    const me = await requirePlatformAdmin();
    const orgId = String(formData.get("orgId") ?? "");
    const [org] = await withService((tx) =>
      tx.select({ id: organizations.id, clerkId: organizations.clerkId }).from(organizations).where(eq(organizations.id, orgId)).limit(1),
    );
    if (!org) return { error: "Organization not found" };
    await run(me, org, formData);
    revalidatePath(`/organizations/${org.id}`);
    return { ok: true };
  } catch (error) {
    return { error: message(error) };
  }
}

export async function changePlan(_prev: OrgActionState, formData: FormData): Promise<OrgActionState> {
  return orgAction(formData, async (me, org, formData) => {
  const planId = String(formData.get("planId") ?? "");
  if (!(await activePlans()).some((p) => p.id === planId)) throw new Error("Pick a plan.");
  await setOrgPlan(org.id, planId);
  await recordAudit({ orgId: org.id, actorUserId: me.id, action: "plan.changed_by_admin", metadata: { planId } });
  });
}

/** Add the signed-in admin to the org as Alevo support (admin role, `support` flag). */
export async function joinAsSupport(_prev: OrgActionState, formData: FormData): Promise<OrgActionState> {
  return orgAction(formData, async (me, org) => {
  const { clerkMembershipId } = await addMemberToOrg({ clerkOrgId: org.clerkId, clerkUserId: me.clerkId, role: "admin" });
  // Mirror at once so the page shows it before the webhook lands.
  await withService((tx) =>
    tx
      .insert(memberships)
      .values({ orgId: org.id, userId: me.id, role: "admin", support: true, clerkMembershipId })
      .onConflictDoUpdate({ target: [memberships.orgId, memberships.userId], set: { role: "admin", support: true, clerkMembershipId, updatedAt: new Date() } }),
  );
  await recordAudit({ orgId: org.id, actorUserId: me.id, action: "support.joined" });
  });
}

export async function leaveWorkspace(_prev: OrgActionState, formData: FormData): Promise<OrgActionState> {
  return orgAction(formData, async (me, org) => {
  await removeFromOrg({ clerkOrgId: org.clerkId, clerkUserId: me.clerkId });
  await withService((tx) => tx.delete(memberships).where(and(eq(memberships.orgId, org.id), eq(memberships.userId, me.id))));
  await recordAudit({ orgId: org.id, actorUserId: me.id, action: "support.left" });
  });
}

/** Revoke the pending owner invite (if any) and send a fresh one to the same address. */
export async function resendOwnerInvite(_prev: OrgActionState, formData: FormData): Promise<OrgActionState> {
  return orgAction(formData, async (me, org) => {
  const [pending] = await withService((tx) =>
    tx
      .select({ id: orgInvitations.id, email: orgInvitations.email, clerkInvitationId: orgInvitations.clerkInvitationId })
      .from(orgInvitations)
      .where(and(eq(orgInvitations.orgId, org.id), eq(orgInvitations.role, "owner"), eq(orgInvitations.status, "pending")))
      .limit(1),
  );
  if (!pending) throw new Error("No pending owner invite to resend.");
  if (pending.clerkInvitationId) {
    await revokeOrgInvitation({ clerkOrgId: org.clerkId, clerkInvitationId: pending.clerkInvitationId, requestingClerkUserId: me.clerkId }).catch(() => undefined); // already gone is fine
  }
  const { clerkInvitationId } = await inviteToOrg({ clerkOrgId: org.clerkId, email: pending.email, role: "owner", inviterClerkUserId: me.clerkId });
  await withService((tx) => tx.update(orgInvitations).set({ status: "revoked", updatedAt: new Date() }).where(eq(orgInvitations.id, pending.id)));
  await recordInvitation(org.id, pending.email, clerkInvitationId, me.id);
  await recordAudit({ orgId: org.id, actorUserId: me.id, action: "invite.resent", target: pending.email });
  });
}

/** "Not using this" on Booking / Phone / Slack (and back). */
export async function setDecline(_prev: OrgActionState, formData: FormData): Promise<OrgActionState> {
  return orgAction(formData, async (me, org, formData) => {
  const key = formData.get("key");
  const value = String(formData.get("value")) === "true";
  if (!isDeclineKey(key)) throw new Error("Unknown item");
  await setSetupDecline(org.id, key, value);
  await recordAudit({ orgId: org.id, actorUserId: me.id, action: value ? "setup.declined" : "setup.undeclined", target: key });
  });
}
