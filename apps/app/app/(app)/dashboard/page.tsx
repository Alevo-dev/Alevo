import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { and, desc, eq, sql, type SQLWrapper } from "drizzle-orm";
import { calls, contacts, conversations, meetings } from "@alevo/db";
import { getCurrentOrg, withOrg } from "@alevo/auth";
import { getAgentOn } from "@/lib/agent-on";
import { buttonClass } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Pill, StatusDot } from "@/components/ui/pill";
import { displayName, fmtShort } from "@/lib/format";
import { getOrgTimezone } from "@/lib/org-timezone";
import { CHANNEL_LABEL, CONVERSATION_STATUS } from "@/lib/ui/status";
import { ChannelDonut } from "./channel-donut";
import { KpiTiles, toSeries } from "./kpi-tiles";

// Reads the session + DB, so it must render per-request.
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Dashboard" };

const WINDOW_DAYS = 7;

export default async function DashboardPage() {
  const { orgId } = await auth();

  // Signed in but no active org yet — prompt them to create/select one.
  if (!orgId) {
    return (
      <Card className="mx-auto max-w-md text-center">
        <h1 className="text-heading font-semibold">Create your organization</h1>
        <p className="mt-2 text-sm text-ink-muted">
          Use the organization switcher in the sidebar to create your workspace.
        </p>
      </Card>
    );
  }

  // "Last 7 days" = today plus the six before it, as calendar days in the
  // org's timezone, so the tiles' day bars line up with what the user calls a
  // day. Computed in SQL so the render stays pure (no clock reads).
  const tz = await getOrgTimezone();
  const today = sql`(now() at time zone ${tz})::date`;
  const windowStart = sql`(${today} - ${WINDOW_DAYS - 1}::int)::timestamp at time zone ${tz}`;
  // Whole days ago (0 = today) for a timestamptz column.
  const daysAgo = (col: SQLWrapper) =>
    sql<number>`(${today} - (${col} at time zone ${tz})::date)`.mapWith(Number);
  // Explicit active-org scope on every read (platform admins bypass RLS).
  const inOrg = (
    col:
      typeof conversations.orgId | typeof meetings.orgId | typeof calls.orgId,
  ) => sql`${col} = (select app.current_org_id())`;
  const count = sql<number>`count(*)`.mapWith(Number);

  const [org, convDaily, meetingDaily, callDaily, byChannel, recent, agentOn] =
    await Promise.all([
      getCurrentOrg(),
      withOrg((tx) =>
        tx
          .select({
            ago: daysAgo(conversations.createdAt).as("ago"),
            leads: count,
            qualified:
              sql<number>`count(*) filter (where ${conversations.status} in ('booked','handed_off'))`.mapWith(
                Number,
              ),
          })
          .from(conversations)
          .where(
            and(
              inOrg(conversations.orgId),
              sql`${conversations.createdAt} >= ${windowStart}`,
            ),
          )
          .groupBy(sql`ago`),
      ),
      withOrg((tx) =>
        tx
          .select({ ago: daysAgo(meetings.createdAt).as("ago"), n: count })
          .from(meetings)
          .where(
            and(
              inOrg(meetings.orgId),
              sql`${meetings.createdAt} >= ${windowStart}`,
              sql`${meetings.status} <> 'cancelled'`,
            ),
          )
          .groupBy(sql`ago`),
      ),
      withOrg((tx) =>
        tx
          .select({
            ago: daysAgo(
              sql`coalesce(${calls.startedAt}, ${calls.createdAt})`,
            ).as("ago"),
            n: count,
          })
          .from(calls)
          .where(
            and(
              inOrg(calls.orgId),
              sql`coalesce(${calls.startedAt}, ${calls.createdAt}) >= ${windowStart}`,
            ),
          )
          .groupBy(sql`ago`),
      ),
      withOrg((tx) =>
        tx
          .select({ channel: conversations.channel, n: count })
          .from(conversations)
          .where(
            and(
              inOrg(conversations.orgId),
              sql`${conversations.createdAt} >= ${windowStart}`,
            ),
          )
          .groupBy(conversations.channel)
          .orderBy(desc(sql`count(*)`)),
      ),
      withOrg((tx) =>
        tx
          .select({
            id: conversations.id,
            status: conversations.status,
            channel: conversations.channel,
            fitScore: conversations.fitScore,
            createdAt: conversations.createdAt,
            firstName: contacts.firstName,
            lastName: contacts.lastName,
            email: contacts.email,
            company: contacts.company,
          })
          .from(conversations)
          .innerJoin(contacts, eq(contacts.id, conversations.contactId))
          .where(inOrg(conversations.orgId))
          .orderBy(desc(conversations.createdAt))
          .limit(6),
      ),
      getAgentOn(),
    ]);

  const series = {
    leads: toSeries(
      convDaily.map((r) => ({ ago: r.ago, n: r.leads })),
      WINDOW_DAYS,
    ),
    qualified: toSeries(
      convDaily.map((r) => ({ ago: r.ago, n: r.qualified })),
      WINDOW_DAYS,
    ),
    meetings: toSeries(meetingDaily, WINDOW_DAYS),
    calls: toSeries(callDaily, WINDOW_DAYS),
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        description={
          <>
            <StatusDot tone={agentOn ? "success" : "muted"} live={agentOn} />
            {agentOn ? "Live." : "The agent is off."}{" "}
            {org?.name ?? "Your workspace"}, last {WINDOW_DAYS} days
          </>
        }
      >
        {!agentOn && (
          <Link href="/workspace/agent" className={buttonClass("primary")}>
            Turn the agent on
          </Link>
        )}
      </PageHeader>

      <KpiTiles days={WINDOW_DAYS} {...series} />

      {recent.length === 0 ? (
        <Card>
          <CardHeader
            title="No leads yet"
            hint="Share your hosted lead form, or send a test message from a conversation, and activity shows up here."
          />
          {org && (
            <Link
              href={`/f/${org.id}`}
              className={buttonClass("secondary", "md", "mt-4")}
            >
              Open your lead form
            </Link>
          )}
        </Card>
      ) : (
        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <Card>
            <CardHeader
              title="Recent activity"
              aside={<Link href="/conversations">All conversations</Link>}
            />
            <ol className="mt-2 divide-y divide-hairline">
              {recent.map((c, i) => {
                const status = CONVERSATION_STATUS[c.status];
                return (
                  <li
                    key={c.id}
                    style={{ animationDelay: `${i * 60}ms` }}
                    className="animate-rise grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-1 py-3 sm:grid-cols-[132px_minmax(0,1fr)_auto]"
                  >
                    <span className="tabular font-mono text-label text-ink-muted">
                      {fmtShort(c.createdAt, tz)}
                    </span>
                    <span className="min-w-0 truncate text-sm">
                      <Link
                        href={`/conversations/${c.id}`}
                        transitionTypes={["nav-forward"]}
                        className="font-medium text-ink no-underline hover:underline"
                      >
                        {displayName(c.firstName, c.lastName, c.email)}
                      </Link>
                      <span className="text-ink-muted">
                        {c.company ? `, ${c.company}` : ""},{" "}
                        {CHANNEL_LABEL[c.channel]}
                        {c.fitScore != null ? `, score ${c.fitScore}` : ""}
                      </span>
                    </span>
                    <span className="col-start-2 sm:col-start-3">
                      <Pill tone={status.tone}>{status.label}</Pill>
                    </span>
                  </li>
                );
              })}
            </ol>
          </Card>

          <Card>
            <CardHeader
              title="Where leads come from"
              hint={`Last ${WINDOW_DAYS} days`}
            />
            {byChannel.length === 0 ? (
              <p className="mt-6 text-sm text-ink-muted">
                No new leads in this window.
              </p>
            ) : (
              <ChannelDonut rows={byChannel} />
            )}
          </Card>
        </section>
      )}
    </div>
  );
}
