import { and, eq, sql } from "drizzle-orm";
import { memberships, orgInvitations, users } from "@alevo/db";
import { ForbiddenError, requireRole, withOrg } from "@alevo/auth";
import { Card, CardHeader } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { EmptyRow, Table, Th } from "@/components/ui/table";
import { InviteForm, MemberRow, PendingInviteRow, type InviteView, type MemberView } from "./members-ui";

export const dynamic = "force-dynamic";

export default async function MembersPage() {
  try {
    await requireRole("admin");
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return <Notice tone="warning">You need an admin role to manage members.</Notice>;
    }
    throw error;
  }

  // Scope BOTH reads explicitly to the active org. RLS is the backstop, not the
  // selector: a platform admin bypasses RLS and would otherwise see every org.
  const inActiveOrg = (col: typeof memberships.orgId | typeof orgInvitations.orgId) =>
    sql`${col} = (select app.current_org_id())`;

  const [rows, invites] = await Promise.all([
    withOrg((tx) =>
      tx
        .select({
          userId: users.id,
          clerkUserId: users.clerkId,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          role: memberships.role,
        })
        .from(memberships)
        .innerJoin(users, eq(users.id, memberships.userId))
        .where(inActiveOrg(memberships.orgId)),
    ),
    withOrg((tx) =>
      tx
        .select({
          id: orgInvitations.id,
          email: orgInvitations.email,
          role: orgInvitations.role,
          clerkInvitationId: orgInvitations.clerkInvitationId,
        })
        .from(orgInvitations)
        .where(and(eq(orgInvitations.status, "pending"), inActiveOrg(orgInvitations.orgId))),
    ),
  ]);

  const members: MemberView[] = rows.map((r) => ({
    userId: r.userId,
    clerkUserId: r.clerkUserId,
    email: r.email,
    name: [r.firstName, r.lastName].filter(Boolean).join(" ") || null,
    role: r.role,
  }));
  const pending: InviteView[] = invites;
  const total = members.length + pending.length;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Invite a member" hint="Seats are unlimited on every plan. Reps see the same data as admins." />
        <div className="mt-4">
          <InviteForm />
        </div>
      </Card>

      <Card padding="none">
        <div className="flex items-center justify-between px-6 pt-5">
          <h2 className="text-heading font-semibold">Members</h2>
          <span className="text-label text-ink-muted">
            {total} {total === 1 ? "person" : "people"}
          </span>
        </div>
        <Table className="mt-2">
          <thead>
            <tr>
              <Th>Member</Th>
              <Th>Role</Th>
              <Th className="text-right">Actions</Th>
            </tr>
          </thead>
          <tbody>
            {total === 0 && <EmptyRow colSpan={3}>No members yet.</EmptyRow>}
            {members.map((m) => (
              <MemberRow key={m.userId} member={m} />
            ))}
            {pending.map((inv) => (
              <PendingInviteRow key={inv.id} invite={inv} />
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
