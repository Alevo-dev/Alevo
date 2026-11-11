import { and, eq, lt } from "drizzle-orm";
import { orgSecrets } from "./schema/secrets";
import { platformSecrets } from "./schema/platform-secrets";
import { withService } from "./with-tenant";
import { currentKeyVersion, open, seal } from "./crypto";

/**
 * Move stored secrets written under an older key version to the current one.
 * What they decrypt to does not change; only the key they are sealed under.
 * A dry run (the default for the CLI) counts and writes nothing. Each row is
 * updated only if it is still at the version we read, so a concurrent save is
 * never overwritten. A row that will not open is counted as failed and left as is.
 *
 * Run it only after the code that understands version 2 is live everywhere that
 * reads these rows: older code opens every row with the raw master key and cannot
 * read a re-sealed one.
 */

export type ResealCounts = { found: number; resealed: number; failed: number };
export type ResealReport = { applied: boolean; org: ResealCounts; platform: ResealCounts };

type Sealed = { ciphertext: string; iv: string; authTag: string; keyVersion: number };
const reseal = (row: Sealed) => seal(open(row));

async function resealOrg(apply: boolean, orgId?: string): Promise<ResealCounts> {
  const rows = await withService((tx) =>
    tx
      .select()
      .from(orgSecrets)
      .where(orgId ? and(lt(orgSecrets.keyVersion, currentKeyVersion), eq(orgSecrets.orgId, orgId)) : lt(orgSecrets.keyVersion, currentKeyVersion)),
  );
  const counts = { found: rows.length, resealed: 0, failed: 0 };
  if (!apply) return counts;
  for (const row of rows) {
    try {
      const s = reseal(row);
      const done = await withService((tx) =>
        tx
          .update(orgSecrets)
          .set({ ciphertext: s.ciphertext, iv: s.iv, authTag: s.authTag, keyVersion: s.keyVersion, updatedAt: new Date() })
          .where(and(eq(orgSecrets.id, row.id), eq(orgSecrets.keyVersion, row.keyVersion)))
          .returning({ id: orgSecrets.id }),
      );
      if (done.length) counts.resealed++;
    } catch {
      counts.failed++;
    }
  }
  return counts;
}

async function resealPlatform(apply: boolean): Promise<ResealCounts> {
  const rows = await withService((tx) => tx.select().from(platformSecrets).where(lt(platformSecrets.keyVersion, currentKeyVersion)));
  const counts = { found: rows.length, resealed: 0, failed: 0 };
  if (!apply) return counts;
  for (const row of rows) {
    try {
      const s = reseal(row);
      const done = await withService((tx) =>
        tx
          .update(platformSecrets)
          .set({ ciphertext: s.ciphertext, iv: s.iv, authTag: s.authTag, keyVersion: s.keyVersion, updatedAt: new Date() })
          .where(and(eq(platformSecrets.keyName, row.keyName), eq(platformSecrets.keyVersion, row.keyVersion)))
          .returning({ keyName: platformSecrets.keyName }),
      );
      if (done.length) counts.resealed++;
    } catch {
      counts.failed++;
    }
  }
  return counts;
}

/** With `orgId`, only that org's secrets; without, every org's and the platform's. */
export async function resealSecrets(opts: { apply: boolean; orgId?: string }): Promise<ResealReport> {
  return {
    applied: opts.apply,
    org: await resealOrg(opts.apply, opts.orgId),
    platform: opts.orgId ? { found: 0, resealed: 0, failed: 0 } : await resealPlatform(opts.apply),
  };
}
