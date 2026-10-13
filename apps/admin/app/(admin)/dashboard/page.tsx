import { desc, eq, sql } from "drizzle-orm";
import {
  auditLog,
  memberships,
  orgSubscriptions,
  organizations,
  plans,
  withService,
} from "@alevo/db";

export const dynamic = "force-dynamic";

function fmt(value: Date | string | null): string {
  if (!value) return "—";
  return new Date(value).toISOString().slice(0, 16).replace("T", " ");
}

export default async function DashboardPage() {
  // Access is gated by the (admin) layout (requirePlatformAdmin). Cross-org
  // reads go through the service path.
  const [orgs, recent] = await Promise.all([
    withService((tx) =>
      tx
        .select({
          id: organizations.id,
          name: organizations.name,
          createdAt: organizations.createdAt,
          planKey: plans.key,
          status: orgSubscriptions.status,
          memberCount: sql<number>`count(distinct ${memberships.id})`,
        })
        .from(organizations)
        .leftJoin(memberships, eq(memberships.orgId, organizations.id))
        .leftJoin(orgSubscriptions, eq(orgSubscriptions.orgId, organizations.id))
        .leftJoin(plans, eq(plans.id, orgSubscriptions.planId))
        .groupBy(organizations.id, plans.key, orgSubscriptions.status)
        .orderBy(desc(organizations.createdAt)),
    ),
    withService((tx) =>
      tx
        .select({
          id: auditLog.id,
          action: auditLog.action,
          target: auditLog.target,
          orgId: auditLog.orgId,
          createdAt: auditLog.createdAt,
        })
        .from(auditLog)
        .orderBy(desc(auditLog.createdAt))
        .limit(25),
    ),
  ]);

  return (
    <section className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl">Organizations</h1>
        <p className="mt-1 text-muted-foreground">Every organization on the platform.</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-muted-foreground">
            <tr className="border-b border-border">
              <th className="py-2 pr-4 font-normal">Name</th>
              <th className="py-2 pr-4 font-normal">Members</th>
              <th className="py-2 pr-4 font-normal">Plan</th>
              <th className="py-2 pr-4 font-normal">Status</th>
              <th className="py-2 font-normal">Created</th>
            </tr>
          </thead>
          <tbody>
            {orgs.map((o) => (
              <tr key={o.id} className="border-b border-border">
                <td className="py-2 pr-4">{o.name}</td>
                <td className="py-2 pr-4">{Number(o.memberCount)}</td>
                <td className="py-2 pr-4">{o.planKey ?? "—"}</td>
                <td className="py-2 pr-4 text-muted-foreground">{o.status ?? "—"}</td>
                <td className="py-2 text-muted-foreground">{fmt(o.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-medium">Recent activity</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-muted-foreground">
              <tr className="border-b border-border">
                <th className="py-2 pr-4 font-normal">When</th>
                <th className="py-2 pr-4 font-normal">Action</th>
                <th className="py-2 pr-4 font-normal">Target</th>
                <th className="py-2 font-normal">Org</th>
              </tr>
            </thead>
            <tbody>
              {recent.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-2 text-muted-foreground">
                    No activity yet.
                  </td>
                </tr>
              ) : (
                recent.map((a) => (
                  <tr key={a.id} className="border-b border-border">
                    <td className="py-2 pr-4 text-muted-foreground">{fmt(a.createdAt)}</td>
                    <td className="py-2 pr-4 font-mono text-xs">{a.action}</td>
                    <td className="py-2 pr-4 text-muted-foreground">{a.target ?? "—"}</td>
                    <td className="py-2 font-mono text-xs">{a.orgId?.slice(0, 8) ?? "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
