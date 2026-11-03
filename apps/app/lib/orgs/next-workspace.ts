type Membership = { organization: { id: string }; role: string };

/**
 * Where to land after leaving or deleting workspace `leftId`: one the user owns
 * first, else any other they belong to, else null (nothing left → sign out).
 * `leftId` is skipped explicitly because a stale list may still carry it.
 */
export function nextWorkspace(memberships: readonly Membership[], leftId: string): string | null {
  const rest = memberships.filter((m) => m.organization.id !== leftId);
  return (rest.find((m) => m.role === "org:owner") ?? rest[0])?.organization.id ?? null;
}
