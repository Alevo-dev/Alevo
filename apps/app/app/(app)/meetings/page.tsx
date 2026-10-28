import type { Metadata } from "next";
import Link from "next/link";
import { and, eq, sql, type SQL } from "drizzle-orm";
import { contacts, finishPage, keysetOrder, keysetWhere, meetings, PAGE_SIZE, parseCursor } from "@alevo/db";
import { withOrg } from "@alevo/auth";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { cursorHref, Pager } from "@/components/ui/pager";
import { Pill } from "@/components/ui/pill";
import { StatTile } from "@/components/ui/stat-tile";
import { EmptyRow, Table, Td, Th, Tr } from "@/components/ui/table";
import { displayName, fmtDateTime, tzLabel } from "@/lib/format";
import { getOrgTimezone } from "@/lib/org-timezone";
import { MEETING_STATUS, PROVIDER_LABEL } from "@/lib/ui/status";
import { ManageControls, OutcomeControls } from "./meetings-ui";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Meetings" };

// Explicit active-org scope on every read: platform admins bypass RLS.
const ORG = sql`${meetings.orgId} = (select app.current_org_id())`;
// Latest start first; a meeting not yet scheduled sorts by when it was created.
const KEY = { at: sql`coalesce(${meetings.startAt}, ${meetings.createdAt})`, id: meetings.id };
const countWhere = (cond: SQL) => sql<number>`count(*) filter (where ${cond})`.mapWith(Number);

export default async function MeetingsPage({ searchParams }: { searchParams: Promise<{ cursor?: string }> }) {
  const cursor = parseCursor((await searchParams).cursor);

  // Timezone, the outcome figures (plan.md §11 KPIs, over every meeting) and
  // one page of the list are independent: one round trip.
  const [tz, figureRows, fetched] = await Promise.all([
    getOrgTimezone(),
    withOrg((tx) =>
      tx
        .select({
          booked: countWhere(sql`${meetings.status} <> 'cancelled'`),
          showed: countWhere(sql`${meetings.outcome} = 'showed'`),
          noShows: countWhere(sql`${meetings.outcome} = 'no_show' or ${meetings.status} = 'no_show'`),
          converted: countWhere(sql`${meetings.converted}`),
        })
        .from(meetings)
        .where(ORG),
    ),
    withOrg((tx) =>
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
        .where(and(ORG, keysetWhere(meetings, KEY, cursor)))
        .orderBy(...keysetOrder(KEY, cursor))
        .limit(PAGE_SIZE + 1),
    ),
  ]);
  const page = finishPage(fetched, cursor);
  const figures = figureRows[0] ?? { booked: 0, showed: 0, noShows: 0, converted: 0 };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Meetings"
        description={`Booked by the agent, with the outcome your reps record. Times in ${tzLabel(tz)}.`}
      />

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4" aria-label="Meeting figures">
        <StatTile label="Booked" value={figures.booked} />
        <StatTile label="Showed" value={figures.showed} />
        <StatTile label="No-shows" value={figures.noShows} />
        <StatTile label="Converted to clients" value={figures.converted} />
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
            {page.rows.length === 0 ? (
              <EmptyRow colSpan={6}>
                {cursor ? (
                  <>
                    Nothing on this page. <Link href="/meetings">Back to the latest</Link>.
                  </>
                ) : (
                  "No meetings booked yet."
                )}
              </EmptyRow>
            ) : (
              page.rows.map((m) => {
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
        <Pager newer={page.newer} older={page.older} href={cursorHref("/meetings")} label={`${page.rows.length} of ${figures.booked}`} />
      </Card>
    </div>
  );
}
