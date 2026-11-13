import type { BusinessProfileValues } from "../../app/(app)/workspace/profile/actions";

/** The profile fields a website can tell us about. Criteria and disqualifiers are the owner's call. */
export const IMPORT_KEYS = [
  "companyName", "businessAddress", "contactPhone", "contactEmail", "contactHours", "offering", "idealCustomer",
] as const;

export type ImportedProfile = Partial<Pick<BusinessProfileValues, (typeof IMPORT_KEYS)[number]>>;
export type ImportMode = "fill" | "replace";

const NOT_FOUND = /^(n\/a|none|unknown|null|not (found|available))\.?$/i;

/** Lay imported values over the form's current ones. `fill` only writes into blanks; `replace` overwrites. */
export function mergeImported(
  current: BusinessProfileValues,
  imported: ImportedProfile,
  mode: ImportMode,
): { values: BusinessProfileValues; filled: (keyof ImportedProfile)[] } {
  const values = { ...current };
  const filled: (keyof ImportedProfile)[] = [];
  for (const key of IMPORT_KEYS) {
    const next = imported[key]?.trim();
    if (!next || NOT_FOUND.test(next)) continue;
    if (mode === "fill" && current[key].trim()) continue;
    if (next === current[key]) continue;
    values[key] = next;
    filled.push(key);
  }
  return { values, filled };
}
