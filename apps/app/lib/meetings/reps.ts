/**
 * Pure helpers for meeting reps (migration 0046): the member list the picker
 * offers and the "Booked by rep" tallies. No I/O, so `tests/meetings-reps.test.ts`
 * covers them.
 */
import type { DonutRow } from "@/app/(app)/dashboard/channel-donut";
import type { SelectOption } from "@alevo/ui/select";
import { displayName } from "../format";

/** The Select's value for "no rep". */
export const UNASSIGNED = "";

export type RepMember = { userId: string; firstName: string | null; lastName: string | null; email: string | null; support: boolean };

/** Who can be a rep: the org's own people, never Alevo support staff. Name order, then email. */
export function repOptions(members: RepMember[]): { options: SelectOption[]; names: Map<string, string> } {
  const named = members
    .filter((m) => !m.support)
    .map((m) => ({ id: m.userId, name: displayName(m.firstName, m.lastName, m.email) }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return {
    options: [{ value: UNASSIGNED, label: "Unassigned" }, ...named.map((m) => ({ value: m.id, label: m.name }))],
    names: new Map(named.map((m) => [m.id, m.name])),
  };
}

const PALETTE = ["var(--color-brand)", "var(--color-violet)", "var(--color-success)", "var(--color-warning)", "var(--color-danger)"];
const MUTED = "var(--color-ink-muted)";

/**
 * Meetings per rep for the donut: biggest first, Unassigned last. A rep who is no longer
 * a member (their meetings keep the id until the user row goes) shows as "Former member".
 */
export function tallyReps(counts: { repUserId: string | null; n: number }[], names: ReadonlyMap<string, string>): DonutRow[] {
  const byRep = new Map<string, number>();
  let unassigned = 0;
  let former = 0;
  for (const { repUserId, n } of counts) {
    if (n <= 0) continue;
    if (!repUserId) unassigned += n;
    else if (names.has(repUserId)) byRep.set(repUserId, (byRep.get(repUserId) ?? 0) + n);
    else former += n;
  }
  const reps = [...byRep].sort((a, b) => b[1] - a[1] || (names.get(a[0]) ?? "").localeCompare(names.get(b[0]) ?? ""));
  const rows: DonutRow[] = reps.map(([id, n], i) => ({ key: id, label: names.get(id) ?? "", n, color: PALETTE[i % PALETTE.length]! }));
  if (former > 0) rows.push({ key: "former", label: "Former member", n: former, color: MUTED });
  if (unassigned > 0) rows.push({ key: "unassigned", label: "Unassigned", n: unassigned, color: MUTED });
  return rows;
}
