import { and, desc, eq, inArray, sql } from "drizzle-orm";
import {
  memberships,
  orgInvitations,
  organizations,
  users,
  withService,
  type AppRole,
  type Tx,
} from "@alevo/db";
import { membershipFor } from "./membership-role";

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
type ClerkInvitationData = {
  id: string;
  email_address: string;
  role: string;
  organization_id: string;
  public_metadata?: { alevoRole?: AppRole } | null;
};

const APP_ROLES: readonly AppRole[] = ["viewer", "rep", "admin", "owner"];
function isAppRole(value: unknown): value is AppRole {
  return typeof value === "string" && (APP_ROLES as readonly string[]).includes(value);
}

/** Intended app role for an invite: our publicMetadata if valid, else map Clerk's role. */
function invitationRole(data: ClerkInvitationData): AppRole {
  const fromMetadata = data.public_metadata?.alevoRole;
  if (isAppRole(fromMetadata)) return fromMetadata;
  return data.role === "org:admin" ? "admin" : "rep";
}

function primaryEmail(data: ClerkUserData): string | null {
  const list = data.email_addresses ?? [];
  const primary = list.find((e) => e.id === data.primary_email_address_id);
  return primary?.email_address ?? list[0]?.email_address ?? null;
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
  const [org] = await withService((tx) =>
    tx
      .insert(organizations)
      .values(values)
      .onConflictDoUpdate({
        target: organizations.clerkId,
        set: { name: values.name, slug: values.slug, updatedAt: new Date() },
      })
      .returning({ id: organizations.id }),
  );
  if (!org) throw new Error("Failed to mirror organization");
  return org;
}

/**
 * Mirror a membership. Backfills the org and user rows first, because Clerk can
 * deliver the membership event before user.created / organization.created
 * (plan.md gotcha: webhook ordering).
 */
export async function mirrorMembership(data: ClerkMembershipData) {
  const pud = data.public_user_data;
  const isCreator = pud.user_id === data.organization.created_by;

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
      .returning({ id: users.id, isPlatformAdmin: users.isPlatformAdmin });

    if (!org || !user) throw new Error("Failed to backfill org/user for membership");

    // Role + support flag (membership-role.ts): a platform admin is Alevo
    // support; otherwise a matching pending invite's role, else creator → owner,
    // else Clerk's role mapped.
    const { role, support } = membershipFor({
      isPlatformAdmin: user.isPlatformAdmin,
      inviteRole: await applyPendingInviteRole(tx, org.id, pud.identifier ?? null),
      clerkRole: data.role,
      isCreator,
    });

    await tx
      .insert(memberships)
      .values({ orgId: org.id, userId: user.id, role, support, clerkMembershipId: data.id })
      .onConflictDoUpdate({
        target: [memberships.orgId, memberships.userId],
        // `membership.updated` (a Clerk-role change, a re-sync) must never lower a
        // real owner: Clerk only knows admin/member, so "owner" lives here alone.
        set: {
          role: sql`case when ${memberships.role} = 'owner' and not excluded.support then 'owner' else excluded.role end`,
          support,
          clerkMembershipId: data.id,
          updatedAt: new Date(),
        },
      });
  });
}

/**
 * If an invite matches (org, email), mark it accepted and return its role.
 * Accepted invites match too: Svix does not order event types, so
 * `organizationInvitation.accepted` can land before this membership event.
 * Returns null if there is none (e.g. the org creator, or a Clerk-dashboard
 * add). `tx` is the surrounding service transaction.
 */
async function applyPendingInviteRole(
  tx: Tx,
  orgId: string,
  email: string | null,
): Promise<AppRole | null> {
  if (!email) return null;
  const [invite] = await tx
    .select({ id: orgInvitations.id, role: orgInvitations.role })
    .from(orgInvitations)
    .where(
      and(
        eq(orgInvitations.orgId, orgId),
        inArray(orgInvitations.status, ["pending", "accepted"]),
        sql`lower(${orgInvitations.email}) = lower(${email})`,
      ),
    )
    .orderBy(desc(orgInvitations.createdAt))
    .limit(1);
  if (!invite) return null;
  await tx.update(orgInvitations).set({ status: "accepted", updatedAt: new Date() }).where(eq(orgInvitations.id, invite.id));
  return invite.role;
}

/** Mirror an org invitation (created in our UI, or in the Clerk dashboard). */
export async function mirrorInvitation(data: ClerkInvitationData) {
  await withService(async (tx) => {
    const [org] = await tx
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.clerkId, data.organization_id))
      .limit(1);
    // Org not mirrored yet (webhook ordering): fail so Svix retries this event
    // after organization.created has landed — returning would lose the invite.
    if (!org) throw new Error(`Invitation ${data.id} for unmirrored org ${data.organization_id}`);

    await tx
      .insert(orgInvitations)
      .values({
        orgId: org.id,
        email: data.email_address,
        role: invitationRole(data),
        status: "pending",
        clerkInvitationId: data.id,
      })
      .onConflictDoUpdate({
        target: orgInvitations.clerkInvitationId,
        set: { role: invitationRole(data), updatedAt: new Date() },
      });
  });
}

/** Mark a mirrored invitation accepted or revoked (keyed by Clerk invitation id). */
export async function setInvitationStatus(
  clerkInvitationId: string,
  status: "accepted" | "revoked",
) {
  await withService((tx) =>
    tx
      .update(orgInvitations)
      .set({ status, updatedAt: new Date() })
      .where(eq(orgInvitations.clerkInvitationId, clerkInvitationId)),
  );
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
  ClerkInvitationData,
};
