import "server-only";
import { recordAudit, setOrgSecret } from "@alevo/db";
import { FIELD_PREFIX, getSecretSpec, isSecretKey, type SecretKey } from "@/lib/secrets-registry";

export type SecretEntry = { key: SecretKey; value: string };
export type SecretErrors = Partial<Record<SecretKey, string>>;

/**
 * Pull every filled-in `secret.<key>` field out of a form. Blank fields are
 * skipped (they mean "keep the stored value"). `allowed` restricts which keys
 * a given form may set; anything else is rejected.
 */
export function readSecretFields(formData: FormData, allowed?: readonly SecretKey[]): SecretEntry[] {
  const entries: SecretEntry[] = [];
  for (const [name, raw] of formData.entries()) {
    if (typeof raw !== "string" || !name.startsWith(FIELD_PREFIX)) continue;
    const key = name.slice(FIELD_PREFIX.length);
    if (!isSecretKey(key) || (allowed && !allowed.includes(key))) throw new Error("Unknown secret");
    const value = raw.trim();
    if (value) entries.push({ key, value });
  }
  return entries;
}

/** Format checks from the registry, keyed by secret. Empty when all pass. */
export function validateSecrets(entries: SecretEntry[]): SecretErrors {
  const errors: SecretErrors = {};
  for (const { key, value } of entries) {
    const formatError = getSecretSpec(key).validate?.(value);
    if (formatError) errors[key] = formatError;
  }
  return errors;
}

/** Encrypt + store each entry and audit it. Call only after validateSecrets passed. */
export async function storeSecrets(orgId: string, actorUserId: string | null, entries: SecretEntry[]): Promise<void> {
  await Promise.all(
    entries.map(async ({ key, value }) => {
      await setOrgSecret(orgId, key, value);
      await recordAudit({ orgId, actorUserId, action: "secret.set", target: key });
    }),
  );
}
