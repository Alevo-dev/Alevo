import type { AppRole } from "@alevo/db";

/**
 * Role + support flag for a mirrored Clerk membership (migration 0030). A platform
 * admin is Alevo support (admin role, never owner, even as the org's creator) UNLESS
 * the org invited them with an explicit role: then they are a real member with that
 * role, e.g. an owner, and are still a platform admin. The console can also switch
 * a membership between the two (`setMemberMode`). Everyone else: the pending invite's
 * role, else creator → owner, else Clerk's two roles mapped (org:admin → admin,
 * anything else → rep).
 */
export function membershipFor(input: {
  isPlatformAdmin: boolean;
  inviteRole: AppRole | null;
  clerkRole: string;
  isCreator: boolean;
}): { role: AppRole; support: boolean } {
  if (input.inviteRole) return { role: input.inviteRole, support: false };
  if (input.isPlatformAdmin) return { role: "admin", support: true };
  if (input.isCreator) return { role: "owner", support: false };
  return { role: input.clerkRole === "org:admin" ? "admin" : "rep", support: false };
}
