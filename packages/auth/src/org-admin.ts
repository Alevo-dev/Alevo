import "server-only";
import { auth, clerkClient } from "@clerk/nextjs/server";
import type { AppRole } from "@alevo/db";
import { clerk } from "./clerk-errors";
import { UnauthorizedError } from "./errors";

/**
 * Clerk organization admin operations. These are mechanical wrappers only —
 * authorization (requireRole / requirePlatformAdmin) happens in the calling
 * server action. This is the sole place that calls the Clerk backend API (rule 3).
 *
 * Two shapes: the `…ActiveOrg` functions act on the session's active org (the
 * Members tab); the explicit-org functions take a `clerkOrgId` so the admin
 * console can provision and support a workspace it is not switched into.
 */

/** Map our 4 app roles → Clerk's 2 org roles (which only gate "can manage membership"). */
export function toClerkRole(role: AppRole): "org:admin" | "org:member" {
  return role === "admin" || role === "owner" ? "org:admin" : "org:member";
}

async function activeContext() {
  const { userId, orgId } = await auth();
  if (!userId) throw new UnauthorizedError("Not signed in");
  if (!orgId) throw new UnauthorizedError("No active organization");
  return { userId, orgId };
}

// ── Explicit org ────────────────────────────────────────────────────────────

/** Create an organization; Clerk makes `createdBy` an org:admin member at once. */
export async function createOrganizationAs(p: { name: string; createdByClerkUserId: string }): Promise<{ clerkOrgId: string }> {
  const client = await clerkClient();
  const org = await clerk(() => client.organizations.createOrganization({ name: p.name, createdBy: p.createdByClerkUserId }));
  return { clerkOrgId: org.id };
}

/** Invite someone to an org; the intended app role rides in publicMetadata. */
export async function inviteToOrg(p: { clerkOrgId: string; email: string; role: AppRole; inviterClerkUserId: string }) {
  const client = await clerkClient();
  // Where Clerk sends the invitee after they accept. Must be publicly reachable
  // (the ngrok URL in dev — the invite is often opened on another device, so
  // localhost won't work). The <SignUp>/<SignIn> pages handle the __clerk_ticket.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const invitation = await clerk(() => client.organizations.createOrganizationInvitation({
    organizationId: p.clerkOrgId,
    emailAddress: p.email,
    role: toClerkRole(p.role),
    inviterUserId: p.inviterClerkUserId,
    publicMetadata: { alevoRole: p.role },
    ...(appUrl ? { redirectUrl: `${appUrl}/sign-up` } : {}),
  }));
  return { clerkInvitationId: invitation.id };
}

export async function revokeOrgInvitation(p: { clerkOrgId: string; clerkInvitationId: string; requestingClerkUserId: string }): Promise<void> {
  const client = await clerkClient();
  await clerk(() => client.organizations.revokeOrganizationInvitation({
    organizationId: p.clerkOrgId,
    invitationId: p.clerkInvitationId,
    requestingUserId: p.requestingClerkUserId,
  }));
}

/** Add an existing Clerk user to an org directly (no invite) — the console's "Join as support". */
export async function addMemberToOrg(p: { clerkOrgId: string; clerkUserId: string; role: AppRole }): Promise<{ clerkMembershipId: string }> {
  const client = await clerkClient();
  const m = await clerk(() => client.organizations.createOrganizationMembership({ organizationId: p.clerkOrgId, userId: p.clerkUserId, role: toClerkRole(p.role) }));
  return { clerkMembershipId: m.id };
}

export async function removeFromOrg(p: { clerkOrgId: string; clerkUserId: string }): Promise<void> {
  const client = await clerkClient();
  await clerk(() => client.organizations.deleteOrganizationMembership({ organizationId: p.clerkOrgId, userId: p.clerkUserId }));
}

// ── Active org ──────────────────────────────────────────────────────────────

export async function inviteToActiveOrg(params: { email: string; role: AppRole }) {
  const { userId, orgId } = await activeContext();
  return inviteToOrg({ clerkOrgId: orgId, email: params.email, role: params.role, inviterClerkUserId: userId });
}

export async function revokeActiveOrgInvitation(clerkInvitationId: string) {
  const { userId, orgId } = await activeContext();
  await revokeOrgInvitation({ clerkOrgId: orgId, clerkInvitationId, requestingClerkUserId: userId });
}

export async function setActiveOrgMemberRole(clerkUserId: string, role: AppRole) {
  const { orgId } = await activeContext();
  const client = await clerkClient();
  await clerk(() => client.organizations.updateOrganizationMembership({
    organizationId: orgId,
    userId: clerkUserId,
    role: toClerkRole(role),
  }));
}

export async function removeFromActiveOrg(clerkUserId: string) {
  const { orgId } = await activeContext();
  await removeFromOrg({ clerkOrgId: orgId, clerkUserId });
}

/** The caller leaves the active org (removes their own membership). */
export async function leaveActiveOrg() {
  const { userId, orgId } = await activeContext();
  await removeFromOrg({ clerkOrgId: orgId, clerkUserId: userId });
}

/** Delete the active org in Clerk (the `organization.deleted` lifecycle). */
export async function deleteActiveOrg() {
  const { orgId } = await activeContext();
  const client = await clerkClient();
  await clerk(() => client.organizations.deleteOrganization(orgId));
}
