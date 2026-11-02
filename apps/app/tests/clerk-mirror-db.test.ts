import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { memberships, orgInvitations, organizations, users, withService } from "@alevo/db";
import { mirrorInvitation, mirrorMembership } from "../lib/webhooks/clerk-mirror";

/**
 * Webhook ordering the provisioning flow depends on (review findings #2–#4).
 * Real DB; skipped without DATABASE_URL.
 */
const HAS_DB = Boolean(process.env.DATABASE_URL);
const STAMP = Date.now();
const CLERK_ORG = `org_test_mirror_${STAMP}`;
const CLERK_USER = `user_test_mirror_${STAMP}`;
const EMAIL = `owner-${STAMP}@test.dev`;
let orgId = "";
let userId = "";

const membership = (role: string) => ({
  id: `orgmem_test_${STAMP}`,
  role,
  public_user_data: { user_id: CLERK_USER, identifier: EMAIL, first_name: "Test", last_name: "Owner" },
  organization: { id: CLERK_ORG, name: "Mirror test", created_by: "user_somebody_else" },
});

async function role() {
  const [row] = await withService((tx) =>
    tx.select({ role: memberships.role }).from(memberships).where(and(eq(memberships.orgId, orgId), eq(memberships.userId, userId))),
  );
  return row?.role;
}

beforeAll(async () => {
  if (!HAS_DB) return;
  const [[org], [user]] = await Promise.all([
    withService((tx) => tx.insert(organizations).values({ clerkId: CLERK_ORG, name: "Mirror test" }).returning({ id: organizations.id })),
    withService((tx) => tx.insert(users).values({ clerkId: CLERK_USER, email: EMAIL }).returning({ id: users.id })),
  ]);
  orgId = org!.id;
  userId = user!.id;
});

afterAll(async () => {
  if (!HAS_DB || !orgId) return;
  await withService((tx) => tx.delete(organizations).where(eq(organizations.id, orgId)));
  await withService((tx) => tx.delete(users).where(eq(users.id, userId)));
});

describe.skipIf(!HAS_DB)("clerk mirror ordering", () => {
  it("an invite already marked accepted still gives the member its role", async () => {
    await withService((tx) =>
      tx.insert(orgInvitations).values({ orgId, email: EMAIL, role: "owner", status: "accepted", clerkInvitationId: `orginv_test_${STAMP}` }),
    );
    await mirrorMembership(membership("org:admin"));
    expect(await role()).toBe("owner");
  });

  it("a later membership.updated never lowers a real owner", async () => {
    // No invite left to match: the fallback role would be admin.
    await withService((tx) => tx.update(orgInvitations).set({ status: "revoked" }).where(eq(orgInvitations.orgId, orgId)));
    await mirrorMembership(membership("org:admin"));
    expect(await role()).toBe("owner");
  });

  it("an invitation for an org we have not mirrored yet fails so the webhook is retried", async () => {
    await expect(
      mirrorInvitation({ id: `orginv_missing_${STAMP}`, email_address: EMAIL, role: "org:admin", organization_id: `org_missing_${STAMP}` }),
    ).rejects.toThrow();
  });
});
