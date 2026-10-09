import { eq } from "drizzle-orm";
import {
  memberships,
  organizations,
  users,
  withService,
  type AppRole,
} from "@alevo/db";

/**
 * Minimal structural views of the Clerk webhook payloads — only the fields we
 * mirror. Decouples us from Clerk's exact generated types.
 */
type ClerkEmail = { id: string; email_address: string };
type ClerkUserData = {
  id: string;
  email_addresses?: ClerkEmail[];
  primary_email_address_id?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  image_url?: string | null;
};
type ClerkOrgData = {
  id: string;
  name: string;
  slug?: string | null;
  created_by?: string | null;
};
type ClerkPublicUserData = {
  user_id: string;
  identifier?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  image_url?: string | null;
};
type ClerkMembershipData = {
  id: string;
  role: string;
  public_user_data: ClerkPublicUserData;
  organization: ClerkOrgData;
};

function primaryEmail(data: ClerkUserData): string | null {
  const list = data.email_addresses ?? [];
  const primary = list.find((e) => e.id === data.primary_email_address_id);
  return primary?.email_address ?? list[0]?.email_address ?? null;
}

/**
 * Owner bootstrap (plan.md fix): the org creator becomes `owner`; other admins
 * map to `admin`; everyone else to `rep`. Invitation-carried roles are refined
 * in the Phase 2 members flow.
 */
function resolveRole(clerkRole: string, isCreator: boolean): AppRole {
  if (isCreator) return "owner";
  if (clerkRole === "org:admin") return "admin";
  return "rep";
}

export async function mirrorUser(data: ClerkUserData) {
  const values = {
    clerkId: data.id,
    email: primaryEmail(data),
    firstName: data.first_name ?? null,
    lastName: data.last_name ?? null,
    imageUrl: data.image_url ?? null,
  };
  await withService((tx) =>
    tx
      .insert(users)
      .values(values)
      .onConflictDoUpdate({
        target: users.clerkId,
        set: { ...values, updatedAt: new Date() },
      }),
  );
}

export async function mirrorOrg(data: ClerkOrgData) {
  const values = { clerkId: data.id, name: data.name, slug: data.slug ?? null };
  await withService((tx) =>
    tx
      .insert(organizations)
      .values(values)
      .onConflictDoUpdate({
        target: organizations.clerkId,
        set: { name: values.name, slug: values.slug, updatedAt: new Date() },
      }),
  );
}

/**
 * Mirror a membership. Backfills the org and user rows first, because Clerk can
 * deliver the membership event before user.created / organization.created
 * (plan.md gotcha: webhook ordering).
 */
export async function mirrorMembership(data: ClerkMembershipData) {
  const pud = data.public_user_data;
  const isCreator = pud.user_id === data.organization.created_by;
  const role = resolveRole(data.role, isCreator);

  await withService(async (tx) => {
    const [org] = await tx
      .insert(organizations)
      .values({
        clerkId: data.organization.id,
        name: data.organization.name,
        slug: data.organization.slug ?? null,
      })
      .onConflictDoUpdate({
        target: organizations.clerkId,
        set: { name: data.organization.name, updatedAt: new Date() },
      })
      .returning({ id: organizations.id });

    const [user] = await tx
      .insert(users)
      .values({
        clerkId: pud.user_id,
        email: pud.identifier ?? null,
        firstName: pud.first_name ?? null,
        lastName: pud.last_name ?? null,
        imageUrl: pud.image_url ?? null,
      })
      .onConflictDoUpdate({ target: users.clerkId, set: { updatedAt: new Date() } })
      .returning({ id: users.id });

    if (!org || !user) throw new Error("Failed to backfill org/user for membership");

    await tx
      .insert(memberships)
      .values({ orgId: org.id, userId: user.id, role, clerkMembershipId: data.id })
      .onConflictDoUpdate({
        target: [memberships.orgId, memberships.userId],
        set: { role, clerkMembershipId: data.id, updatedAt: new Date() },
      });
  });
}

export async function removeMembership(data: { id: string }) {
  await withService((tx) =>
    tx.delete(memberships).where(eq(memberships.clerkMembershipId, data.id)),
  );
}

export type {
  ClerkUserData,
  ClerkOrgData,
  ClerkMembershipData,
};
