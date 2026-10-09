import { eq } from "drizzle-orm";
import { memberships, orgInvitations, users } from "@alevo/db";
import { ForbiddenError, requireRole, withOrg } from "@alevo/auth";
import {
  InviteForm,
  MemberRow,
  PendingInviteRow,
  type InviteView,
  type MemberView,
} from "./members-ui";

export const dynamic = "force-dynamic";

export default async function MembersPage() {
  try {
    await requireRole("admin");
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return (
        <p className="text-muted-foreground">
          You need an admin role to manage members.
        </p>
      );
    }
    throw error;
  }

  // RLS scopes both reads to the active org.
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
        .innerJoin(users, eq(users.id, memberships.userId)),
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
        .where(eq(orgInvitations.status, "pending")),
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

  return (
    <section className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl">Members</h1>
        <p className="mt-1 text-muted-foreground">
          Invite teammates and manage their roles.
        </p>
      </div>

      <div className="rounded-lg border border-border p-4">
        <h2 className="mb-3 text-sm font-medium">Invite a teammate</h2>
        <InviteForm />
      </div>

      <div>
        <h2 className="mb-2 text-sm font-medium">
          Members <span className="text-muted-foreground">({members.length})</span>
        </h2>
        <table className="w-full text-left text-sm">
          <thead className="text-muted-foreground">
            <tr className="border-b border-border">
              <th className="py-2 pr-4 font-normal">Name</th>
              <th className="py-2 pr-4 font-normal">Email</th>
              <th className="py-2 pr-4 font-normal">Role</th>
              <th className="py-2 font-normal" />
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <MemberRow key={m.userId} member={m} />
            ))}
          </tbody>
        </table>
      </div>

      {pending.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-medium">
            Pending invitations{" "}
            <span className="text-muted-foreground">({pending.length})</span>
          </h2>
          <table className="w-full text-left text-sm">
            <thead className="text-muted-foreground">
              <tr className="border-b border-border">
                <th className="py-2 pr-4 font-normal">Email</th>
                <th className="py-2 pr-4 font-normal">Role</th>
                <th className="py-2 font-normal" />
              </tr>
            </thead>
            <tbody>
              {pending.map((inv) => (
                <PendingInviteRow key={inv.id} invite={inv} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
