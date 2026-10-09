import "server-only";
import { auth, clerkClient } from "@clerk/nextjs/server";
import type { AppRole } from "@alevo/db";
import { UnauthorizedError } from "./errors";

/**
 * Clerk organization admin operations for the active org. These are mechanical
 * wrappers only — authorization (requireRole) happens in the calling server
 * action. This is the sole place that calls the Clerk backend API (rule 3).
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

/** Invite someone to the active org; the intended app role rides in publicMetadata. */
export async function inviteToActiveOrg(params: { email: string; role: AppRole }) {
  const { userId, orgId } = await activeContext();
  const client = await clerkClient();
  const invitation = await client.organizations.createOrganizationInvitation({
    organizationId: orgId,
    emailAddress: params.email,
    role: toClerkRole(params.role),
    inviterUserId: userId,
    publicMetadata: { alevoRole: params.role },
  });
  return { clerkInvitationId: invitation.id };
}

export async function revokeActiveOrgInvitation(clerkInvitationId: string) {
  const { userId, orgId } = await activeContext();
  const client = await clerkClient();
  await client.organizations.revokeOrganizationInvitation({
    organizationId: orgId,
    invitationId: clerkInvitationId,
    requestingUserId: userId,
  });
}

export async function setActiveOrgMemberRole(clerkUserId: string, role: AppRole) {
  const { orgId } = await activeContext();
  const client = await clerkClient();
  await client.organizations.updateOrganizationMembership({
    organizationId: orgId,
    userId: clerkUserId,
    role: toClerkRole(role),
  });
}

export async function removeFromActiveOrg(clerkUserId: string) {
  const { orgId } = await activeContext();
  const client = await clerkClient();
  await client.organizations.deleteOrganizationMembership({
    organizationId: orgId,
    userId: clerkUserId,
  });
}
