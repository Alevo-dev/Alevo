import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { loadReadinessFacts, readiness } from "@alevo/db";
import { requirePlatformAdmin } from "@alevo/auth";
import { Card, CardHeader } from "@alevo/ui/card";
import { Notice } from "@alevo/ui/notice";
import { PageHeader } from "@alevo/ui/page-header";
import { Pill, StatusDot } from "@alevo/ui/pill";
import { EmptyRow, Table, Td, Th, Tr } from "@alevo/ui/table";
import { fmtWhen } from "@/lib/metrics-format";
import { orgDetail } from "@/lib/org-detail";
import { activePlans } from "@/lib/plans";
import { resendOwnerInvite } from "../actions";
import { ActionForm } from "./action-form";
import { OrgActionsBar } from "./org-actions-bar";
import { PlanCard } from "./plan-card";
import { SetupCard } from "./setup-card";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Organization" };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ notice?: string }> };

/** One workspace: plan + status, support actions, the Setup checklist, members and invites, the plan. No lead data here. */
export default async function OrganizationPage({ params, searchParams }: Props) {
  const [{ id }, { notice }, me] = await Promise.all([params, searchParams, requirePlatformAdmin()]);
  const [org, facts, plans] = await Promise.all([orgDetail(id), loadReadinessFacts(id), activePlans()]);
  if (!org) notFound();

  const items = readiness(facts);
  const member = org.members.some((m) => m.userId === me.id);
  const ownerPending = org.invites.some((i) => i.role === "owner" && i.status === "pending");

  return (
    <div className="space-y-6">
      <PageHeader
        title={org.name}
        description={
          <>
            <Link href="/organizations">Organizations</Link>
            <span aria-hidden="true">·</span>
            <Pill tone={org.status === "active" ? "success" : org.status === "trialing" ? "brand" : org.status ? "warning" : "muted"}>
              {org.planName ? `${org.planName} · ${org.status?.replace("_", " ")}` : "No plan"}
            </Pill>
            <StatusDot tone={org.agentOn ? "success" : "muted"} live={org.agentOn} />
            {org.agentOn ? "Agent on" : "Agent off"}
            <span aria-hidden="true">·</span>
            Created {fmtWhen(org.createdAt)}
          </>
        }
      >
        <OrgActionsBar orgId={org.id} clerkOrgId={org.clerkId} member={member} />
      </PageHeader>

      {notice === "join-first" && <Notice tone="warning">Join as support first, then open the workspace.</Notice>}

      <SetupCard orgId={org.id} clerkOrgId={org.clerkId} items={items} />

      <Card padding="none">
        <div className="px-6 pt-6">
          <CardHeader title="Members" hint={`${org.members.filter((m) => !m.support).length} seat${org.members.filter((m) => !m.support).length === 1 ? "" : "s"} in use`} />
        </div>
        <Table className="mt-4">
          <thead>
            <tr>
              <Th>Name</Th>
              <Th>Email</Th>
              <Th>Role</Th>
            </tr>
          </thead>
          <tbody>
            {org.members.length === 0 && org.invites.length === 0 && <EmptyRow colSpan={3}>No members yet.</EmptyRow>}
            {org.members.map((m) => (
              <Tr key={m.userId}>
                <Td className="font-medium text-ink">{m.name ?? "—"}</Td>
                <Td className="text-ink-muted">{m.email ?? "—"}</Td>
                <Td>{m.support ? <Pill tone="muted">Alevo support</Pill> : <Pill tone="brand">{m.role[0]!.toUpperCase() + m.role.slice(1)}</Pill>}</Td>
              </Tr>
            ))}
            {org.invites
              .filter((i) => i.status !== "revoked")
              .map((i) => (
                <Tr key={i.id}>
                  <Td className="text-ink-muted">Invited</Td>
                  <Td className="text-ink-muted">{i.email}</Td>
                  <Td>
                    <Pill tone={i.status === "pending" ? "warning" : "success"}>
                      {i.role[0]!.toUpperCase() + i.role.slice(1)} · {i.status}
                    </Pill>
                  </Td>
                </Tr>
              ))}
          </tbody>
        </Table>
        {ownerPending && (
          <div className="border-t border-hairline px-6 py-4">
            <ActionForm action={resendOwnerInvite} fields={{ orgId: org.id }}>
              Resend owner invite
            </ActionForm>
          </div>
        )}
      </Card>

      <PlanCard orgId={org.id} planId={org.planId} plans={plans} />
    </div>
  );
}
