import { eq } from "drizzle-orm";
import { platformSecrets } from "./schema/platform-secrets";
import { withService } from "./with-tenant";
import { open, seal } from "./crypto";

/**
 * Platform-level secret store (Alevo's own credentials, not a tenant's).
 * Same envelope and rules as the org store: service path, SERVER-ONLY, and
 * the plaintext never reaches the browser.
 */

/** The keys the admin console manages. */
export type PlatformSecretKey = "internal_alerts_slack_webhook";

export async function setPlatformSecret(keyName: PlatformSecretKey, plaintext: string): Promise<void> {
  const sealed = seal(plaintext);
  await withService((tx) =>
    tx
      .insert(platformSecrets)
      .values({ keyName, ciphertext: sealed.ciphertext, iv: sealed.iv, authTag: sealed.authTag, keyVersion: sealed.keyVersion })
      .onConflictDoUpdate({
        target: platformSecrets.keyName,
        set: { ciphertext: sealed.ciphertext, iv: sealed.iv, authTag: sealed.authTag, keyVersion: sealed.keyVersion, updatedAt: new Date() },
      }),
  );
}

export async function getPlatformSecret(keyName: PlatformSecretKey): Promise<string | null> {
  const [row] = await withService((tx) => tx.select().from(platformSecrets).where(eq(platformSecrets.keyName, keyName)).limit(1));
  if (!row) return null;
  return open({ ciphertext: row.ciphertext, iv: row.iv, authTag: row.authTag, keyVersion: row.keyVersion });
}

export async function deletePlatformSecret(keyName: PlatformSecretKey): Promise<void> {
  await withService((tx) => tx.delete(platformSecrets).where(eq(platformSecrets.keyName, keyName)));
}

/** Whether a key is stored (never its value) plus when it was last saved. */
export async function platformSecretStatus(keyName: PlatformSecretKey): Promise<{ isSet: boolean; updatedAt: Date | null }> {
  const [row] = await withService((tx) =>
    tx.select({ updatedAt: platformSecrets.updatedAt }).from(platformSecrets).where(eq(platformSecrets.keyName, keyName)).limit(1),
  );
  return { isSet: Boolean(row), updatedAt: row?.updatedAt ?? null };
}
