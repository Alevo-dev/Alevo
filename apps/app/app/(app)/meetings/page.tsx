import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { contacts, meetings } from "@alevo/db";
import { withOrg } from "@alevo/auth";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Pill } from "@/components/ui/pill";
import { StatTile } from "@/components/ui/stat-tile";
import { EmptyRow, Table, Td, Th, Tr } from "@/components/ui/table";
import { displayName, fmtDateTime, tzLabel } from "@/lib/format";
import { getOrgTimezone } from "@/lib/org-timezone";
import { MEETING_STATUS, PROVIDER_LABEL } from "@/lib/ui/status";
import { ManageControls, OutcomeControls } from "./meetings-ui";

export const dynamic = "force-dynamic";

export default async function MeetingsPage() {
  const tz = await getOrgTimezone();
  // Explicit active-org scope (platform admins bypass RLS).
  const rows = await withOrg((tx) =>
    tx
      .select({
        id: meetings.id,
        status: meetings.status,
        outcome: meetings.outcome,
        converted: meetings.converted,
        provider: meetings.provider,
        startAt: meetings.startAt,
        joinUrl: meetings.joinUrl,
        conversationId: meetings.conversationId,
        firstName: contacts.firstName,
        lastName: contacts.lastName,
        email: contacts.email,
      })
      .from(meetings)
      .leftJoin(contacts, eq(contacts.id, meetings.contactId))
      .where(sql`${meetings.orgId} = (select app.current_org_id())`)
      .orderBy(desc(meetings.startAt)),
  );

  // Outcome figures from the same rows (plan.md §11 KPIs).
  const booked = rows.filter((m) => m.status !== "cancelled").length;
  const showed = rows.filter((m) => m.outcome === "showed").length;
  const noShows = rows.filter((m) => m.outcome === "no_show" || m.status === "no_show").length;
  const converted = rows.filter((m) => m.converted).length;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Meetings"
        description={`Booked by the agent, with the outcome your reps record. Times in ${tzLabel(tz)}.`}
      />

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4" aria-label="Meeting figures">
        <StatTile label="Booked" value={booked} />
        <StatTile label="Showed" value={showed} />
        <StatTile label="No-shows" value={noShows} />
        <StatTile label="Converted to clients" value={converted} />
      </section>

      <Card padding="none">
        <Table>
          <thead>
            <tr>
              <Th>Contact</Th>
              <Th>When ({tzLabel(tz)})</Th>
              <Th>Status</Th>
              <Th>Source</Th>
              <Th>Outcome</Th>
              <Th className="text-right">Manage</Th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <EmptyRow colSpan={6}>No meetings booked yet.</EmptyRow>
            ) : (
              rows.map((m) => {
                const status = MEETING_STATUS[m.status];
                const who = displayName(m.firstName, m.lastName, m.email);
                return (
                  <Tr key={m.id}>
                    <Td>
                      {m.conversationId ? (
                        <Link href={`/conversations/${m.conversationId}`} transitionTypes={["nav-forward"]} className="font-semibold text-ink no-underline hover:underline">
                          {who}
                        </Link>
                      ) : (
                        <span className="font-semibold">{who}</span>
                      )}
                      {m.joinUrl && (
                        <a href={m.joinUrl} target="_blank" rel="noopener noreferrer" className="block text-label">
                          Join link
                        </a>
                      )}
                    </Td>
                    <Td className="tabular font-mono text-label text-ink-muted">{fmtDateTime(m.startAt, tz)}</Td>
                    <Td>
                      <Pill tone={status.tone}>{status.label}</Pill>
                    </Td>
                    <Td className="text-ink-muted">{PROVIDER_LABEL[m.provider]}</Td>
                    <Td>
                      <OutcomeControls id={m.id} status={m.status} outcome={m.outcome} converted={m.converted} />
                    </Td>
                    <Td className="text-right">
                      <ManageControls id={m.id} provider={m.provider} status={m.status} contact={who} />
                    </Td>
                  </Tr>
                );
              })
            )}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
