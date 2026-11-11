import { createCipheriv, randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, inArray } from "drizzle-orm";
import { getOrgSecret, orgSecrets, organizations, resealSecrets, setOrgSecret, withService } from "@alevo/db";

/**
 * Re-sealing moves secrets written under the old key (version 1, the raw master
 * key) to the current derived key, without changing what they decrypt to. Scoped
 * to one org here so the shared dev database's real secrets are never touched.
 */
const ORG = "org_test_reseal";
let orgId: string;
let otherOrgId: string;

/** A secret exactly as the pre-hardening code wrote it: AES-GCM under the master key itself. */
function sealV1(plaintext: string) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", Buffer.from(process.env.SECRETS_MASTER_KEY!, "base64"), iv);
  const ciphertext = Buffer.concat([c.update(plaintext, "utf8"), c.final()]);
  return { ciphertext: ciphertext.toString("base64"), iv: iv.toString("base64"), authTag: c.getAuthTag().toString("base64"), keyVersion: 1 };
}

const versionOf = (org: string, key: string) =>
  withService((tx) => tx.select({ v: orgSecrets.keyVersion }).from(orgSecrets).where(and(eq(orgSecrets.orgId, org), eq(orgSecrets.keyName, key)))).then((r) => r[0]?.v);

beforeAll(async () => {
  await cleanup();
  const rows = await withService((tx) =>
    tx.insert(organizations).values([{ clerkId: ORG, name: "Reseal" }, { clerkId: `${ORG}_other`, name: "Reseal other" }]).returning({ id: organizations.id, clerkId: organizations.clerkId }),
  );
  orgId = rows.find((r) => r.clerkId === ORG)!.id;
  otherOrgId = rows.find((r) => r.clerkId !== ORG)!.id;
  await withService((tx) =>
    tx.insert(orgSecrets).values([
      { orgId, keyName: "old_a", ...sealV1("plain-a") },
      { orgId, keyName: "old_b", ...sealV1("plain-b") },
      { orgId: otherOrgId, keyName: "old_other", ...sealV1("plain-other") },
    ]),
  );
  await setOrgSecret(orgId, "already_new", "plain-new"); // sealed by the current code: version 2
});

afterAll(cleanup);

async function cleanup() {
  await withService((tx) => tx.delete(organizations).where(inArray(organizations.clerkId, [ORG, `${ORG}_other`])));
}

describe("resealSecrets", () => {
  it("a dry run reports what it would change and changes nothing", async () => {
    const r = await resealSecrets({ apply: false, orgId });
    expect(r).toMatchObject({ applied: false, org: { found: 2, resealed: 0, failed: 0 } });
    expect(await versionOf(orgId, "old_a")).toBe(1);
  });

  it("re-seals the old rows of the chosen org to the current version, values intact", async () => {
    const r = await resealSecrets({ apply: true, orgId });
    expect(r.org).toMatchObject({ found: 2, resealed: 2, failed: 0 });
    expect(await versionOf(orgId, "old_a")).toBe(2);
    expect(await getOrgSecret(orgId, "old_a")).toBe("plain-a");
    expect(await getOrgSecret(orgId, "old_b")).toBe("plain-b");
    expect(await getOrgSecret(orgId, "already_new")).toBe("plain-new");
  });

  it("leaves every other org's secrets alone", async () => {
    expect(await versionOf(otherOrgId, "old_other")).toBe(1);
    expect(await getOrgSecret(otherOrgId, "old_other")).toBe("plain-other");
  });

  it("is safe to run again: nothing left to do", async () => {
    const r = await resealSecrets({ apply: true, orgId });
    expect(r.org).toMatchObject({ found: 0, resealed: 0, failed: 0 });
  });
});
