import { and, eq } from "drizzle-orm";
import { orgSecrets } from "./schema/secrets";
import { withService } from "./with-tenant";
import { open, seal } from "./crypto";

/**
 * Per-org secret store. All functions run via the service path and are
 * SERVER-ONLY — never import these into a client component, and never return
 * the plaintext from getOrgSecret to the browser (plan.md rule 12).
 */

/** Encrypt and upsert a secret for an org. */
export async function setOrgSecret(orgId: string, keyName: string, plaintext: string) {
  const sealed = seal(plaintext);
  await withService((tx) =>
    tx
      .insert(orgSecrets)
      .values({
        orgId,
        keyName,
        ciphertext: sealed.ciphertext,
        iv: sealed.iv,
        authTag: sealed.authTag,
        keyVersion: sealed.keyVersion,
      })
      .onConflictDoUpdate({
        target: [orgSecrets.orgId, orgSecrets.keyName],
        set: {
          ciphertext: sealed.ciphertext,
          iv: sealed.iv,
          authTag: sealed.authTag,
          keyVersion: sealed.keyVersion,
          updatedAt: new Date(),
        },
      }),
  );
}

/** Decrypt and return a secret's plaintext, or null if unset. Server-side use only. */
export async function getOrgSecret(orgId: string, keyName: string): Promise<string | null> {
  const [row] = await withService((tx) =>
    tx
      .select()
      .from(orgSecrets)
      .where(and(eq(orgSecrets.orgId, orgId), eq(orgSecrets.keyName, keyName)))
      .limit(1),
  );
  if (!row) return null;
  return open({
    ciphertext: row.ciphertext,
    iv: row.iv,
    authTag: row.authTag,
    keyVersion: row.keyVersion,
  });
}

export async function deleteOrgSecret(orgId: string, keyName: string) {
  await withService((tx) =>
    tx.delete(orgSecrets).where(and(eq(orgSecrets.orgId, orgId), eq(orgSecrets.keyName, keyName))),
  );
}

/** Which secret keys are set for an org (names only — never the values). */
export async function listOrgSecretKeys(orgId: string): Promise<string[]> {
  const rows = await withService((tx) =>
    tx.select({ keyName: orgSecrets.keyName }).from(orgSecrets).where(eq(orgSecrets.orgId, orgId)),
  );
  return rows.map((r) => r.keyName);
}
