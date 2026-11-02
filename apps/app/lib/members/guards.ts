import type { AppRole } from "@alevo/db";

type Target = { role: AppRole; support: boolean };

const SUPPORT = "Alevo support members are managed by Alevo.";

/** Why a member's role may not be changed, or null when it may. */
export function canChangeRole(target: Target): string | null {
  return target.support ? SUPPORT : null;
}

/** Why a member may not be removed, or null when they may. `otherOwners` = real (non-support) owners besides them. */
export function canRemove(target: Target, otherOwners: number): string | null {
  if (target.support) return SUPPORT;
  if (target.role === "owner" && otherOwners === 0) return "Cannot remove the last owner";
  return null;
}
