import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { loadReadinessFacts, orgProfiles, organizations, setSetupDecline, withService } from "@alevo/db";

/**
 * A console-created workspace has no org_profiles row until someone saves a
 * Workspace page. "Not using this" must still stick (review finding #1), and the
 * readiness loader must read it back. Real DB; skipped without DATABASE_URL.
 */
const HAS_DB = Boolean(process.env.DATABASE_URL);
const CLERK_ORG = `org_test_decl_${Date.now()}`;
let orgId = "";

beforeAll(async () => {
  if (!HAS_DB) return;
  const [org] = await withService((tx) => tx.insert(organizations).values({ clerkId: CLERK_ORG, name: "Decline test" }).returning({ id: organizations.id }));
  orgId = org!.id;
});

afterAll(async () => {
  if (!HAS_DB || !orgId) return;
  await withService((tx) => tx.delete(organizations).where(eq(organizations.id, orgId))); // cascades to org_profiles
});

describe.skipIf(!HAS_DB)("setSetupDecline on a workspace with no profile row", () => {
  it("creates the profile row with the flag, and the loader reads it back", async () => {
    await setSetupDecline(orgId, "phone", true);
    const [profile] = await withService((tx) => tx.select().from(orgProfiles).where(eq(orgProfiles.orgId, orgId)));
    expect(profile?.phoneDeclined).toBe(true);
    expect(profile?.bookingDeclined).toBe(false);

    const facts = await loadReadinessFacts(orgId);
    expect(facts.phoneDeclined).toBe(true);
    expect(facts.ownerAccepted).toBe(false);
    expect(facts.agentOn).toBe(false);
    expect(facts.readyDocs).toBe(0);

    await setSetupDecline(orgId, "phone", false);
    expect((await loadReadinessFacts(orgId)).phoneDeclined).toBe(false);
  });
});
