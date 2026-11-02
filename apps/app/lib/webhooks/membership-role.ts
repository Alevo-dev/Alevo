import type { AppRole } from "@alevo/db";

/**
 * Role + support flag for a mirrored Clerk membership (migration 0030). One
 * rule: any platform admin is Alevo support — admin role, never owner, even as
 * the org's creator. Everyone else: the pending invite's role, else creator →
 * owner, else Clerk's two roles mapped (org:admin → admin, anything else → rep).
 */
export function membershipFor(input: {
  isPlatformAdmin: boolean;
  inviteRole: AppRole | null;
  clerkRole: string;
  isCreator: boolean;
}): { role: AppRole; support: boolean } {
  if (input.isPlatformAdmin) return { role: "admin", support: true };
  if (input.inviteRole) return { role: input.inviteRole, support: false };
  if (input.isCreator) return { role: "owner", support: false };
  return { role: input.clerkRole === "org:admin" ? "admin" : "rep", support: false };
}
