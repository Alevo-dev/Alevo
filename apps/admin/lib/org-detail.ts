import { eq } from "drizzle-orm";
import {
  memberships,
  orgInvitations,
  orgProfiles,
  orgSubscriptions,
  organizations,
  plans,
  users,
  withService,
  type AppRole,
  type InvitationStatus,
} from "@alevo/db";

export type OrgDetail = {
  id: string;
  clerkId: string;
  name: string;
  createdAt: Date;
  planId: string | null;
  planName: string | null;
  status: string | null;
  agentOn: boolean;
  members: { userId: string; clerkUserId: string; name: string | null; email: string | null; role: AppRole; support: boolean }[];
  invites: { id: string; email: string; role: AppRole; status: InvitationStatus; clerkInvitationId: string | null }[];
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** One org for the console's org page (service path, gated by the (admin) layout). Null when it doesn't exist. */
export async function orgDetail(id: string): Promise<OrgDetail | null> {
  if (!UUID.test(id)) return null;
  const [[org], members, invites] = await Promise.all([
    withService((tx) =>
      tx
        .select({
          id: organizations.id,
          clerkId: organizations.clerkId,
          name: organizations.name,
          createdAt: organizations.createdAt,
          planId: orgSubscriptions.planId,
          planName: plans.name,
          status: orgSubscriptions.status,
          agentOn: orgProfiles.enabled,
        })
        .from(organizations)
        .leftJoin(orgSubscriptions, eq(orgSubscriptions.orgId, organizations.id))
        .leftJoin(plans, eq(plans.id, orgSubscriptions.planId))
        .leftJoin(orgProfiles, eq(orgProfiles.orgId, organizations.id))
        .where(eq(organizations.id, id))
        .limit(1),
    ),
    withService((tx) =>
      tx
        .select({
          userId: users.id,
          clerkUserId: users.clerkId,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
          role: memberships.role,
          support: memberships.support,
        })
        .from(memberships)
        .innerJoin(users, eq(users.id, memberships.userId))
        .where(eq(memberships.orgId, id))
        .orderBy(memberships.createdAt),
    ),
    withService((tx) =>
      tx
        .select({
          id: orgInvitations.id,
          email: orgInvitations.email,
          role: orgInvitations.role,
          status: orgInvitations.status,
          clerkInvitationId: orgInvitations.clerkInvitationId,
        })
        .from(orgInvitations)
        .where(eq(orgInvitations.orgId, id))
        .orderBy(orgInvitations.createdAt),
    ),
  ]);
  if (!org) return null;
  return {
    ...org,
    agentOn: org.agentOn ?? false,
    members: members.map((m) => ({ ...m, name: [m.firstName, m.lastName].filter(Boolean).join(" ") || null })),
    invites,
  };
}
