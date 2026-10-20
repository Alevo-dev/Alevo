import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { contacts, conversations, meetings, orgProfiles, type Channel } from "@alevo/db";
import { getCurrentOrg, withOrg } from "@alevo/auth";
import { buttonClass } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Pill, StatusDot } from "@/components/ui/pill";
import { StatTile } from "@/components/ui/stat-tile";
import { displayName, fmtCount, fmtShort } from "@/lib/format";
import { getOrgTimezone } from "@/lib/org-timezone";
import { CHANNEL_LABEL, CONVERSATION_STATUS } from "@/lib/ui/status";

// Reads the session + DB, so it must render per-request.
export const dynamic = "force-dynamic";

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

  // The window is computed in SQL so the render stays pure (no clock reads).
  const since = sql.raw(`now() - interval '${WINDOW_DAYS} days'`);
  // Explicit active-org scope on every read (platform admins bypass RLS).
  const inOrg = (col: typeof conversations.orgId | typeof meetings.orgId | typeof orgProfiles.orgId) =>
    sql`${col} = (select app.current_org_id())`;

  const [org, tz, [totals], [booked], byChannel, recent, [profile]] = await Promise.all([
    getCurrentOrg(),
    getOrgTimezone(),
    withOrg((tx) =>
      tx
        .select({
          all: sql<number>`count(*)`.mapWith(Number),
          leads: sql<number>`count(*) filter (where ${conversations.createdAt} >= ${since})`.mapWith(Number),
          qualified: sql<number>`count(*) filter (where ${conversations.createdAt} >= ${since} and ${conversations.status} in ('booked','handed_off'))`.mapWith(Number),
          open: sql<number>`count(*) filter (where ${conversations.status} in ('new','active'))`.mapWith(Number),
        })
        .from(conversations)
        .where(inOrg(conversations.orgId)),
    ),
    withOrg((tx) =>
      tx
        .select({ n: sql<number>`count(*)`.mapWith(Number) })
        .from(meetings)
        .where(
          and(inOrg(meetings.orgId), sql`${meetings.createdAt} >= ${since}`, sql`${meetings.status} <> 'cancelled'`),
        ),
    ),
    withOrg((tx) =>
      tx
        .select({ channel: conversations.channel, n: sql<number>`count(*)`.mapWith(Number) })
        .from(conversations)
        .where(and(inOrg(conversations.orgId), sql`${conversations.createdAt} >= ${since}`))
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
    withOrg((tx) =>
      tx.select({ enabled: orgProfiles.enabled }).from(orgProfiles).where(inOrg(orgProfiles.orgId)).limit(1),
    ),
  ]);

  const agentOn = profile?.enabled ?? false;
  const channelTotal = byChannel.reduce((sum, c) => sum + c.n, 0);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        description={
          <>
            <StatusDot tone={agentOn ? "brand" : "muted"} live={agentOn} />
            {agentOn ? "Live." : "The agent is off."} {org?.name ?? "Your workspace"}, last {WINDOW_DAYS} days
          </>
        }
      >
        {!agentOn && (
          <Link href="/settings/qualifier" className={buttonClass("primary")}>
            Turn the agent on
          </Link>
        )}
      </PageHeader>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4" aria-label="Key figures">
        <StatTile label="Leads in" value={totals?.leads ?? 0} />
        <StatTile label="Qualified" value={totals?.qualified ?? 0} hint="Booked or handed to a rep" />
        <StatTile label="Meetings booked" value={booked?.n ?? 0} />
        <StatTile label="Open conversations" value={totals?.open ?? 0} hint="Being worked now" />
      </section>

      {totals?.all === 0 ? (
        <Card>
          <CardHeader
            title="No leads yet"
            hint="Share your hosted lead form, or send a test message from a conversation, and activity shows up here."
          />
          {org && (
            <Link href={`/f/${org.id}`} className={buttonClass("secondary", "md", "mt-4")}>
              Open your lead form
            </Link>
          )}
        </Card>
      ) : (
        <section className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <Card>
            <CardHeader title="Recent activity" aside={<Link href="/conversations">All conversations</Link>} />
            <ol className="mt-2 divide-y divide-hairline">
              {recent.map((c, i) => {
                const status = CONVERSATION_STATUS[c.status];
                return (
                  <li key={c.id} style={{ animationDelay: `${i * 60}ms` }} className="animate-rise grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-1 py-3 sm:grid-cols-[132px_minmax(0,1fr)_auto]">
                    <span className="tabular font-mono text-label text-ink-muted">{fmtShort(c.createdAt, tz)}</span>
                    <span className="min-w-0 truncate text-sm">
                      <Link href={`/conversations/${c.id}`} className="font-medium text-ink no-underline hover:underline">
                        {displayName(c.firstName, c.lastName, c.email)}
                      </Link>
                      <span className="text-ink-muted">
                        {c.company ? `, ${c.company}` : ""}, {CHANNEL_LABEL[c.channel]}
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
            <CardHeader title="Where leads come from" hint={`Last ${WINDOW_DAYS} days`} />
            {channelTotal === 0 ? (
              <p className="mt-6 text-sm text-ink-muted">No new leads in this window.</p>
            ) : (
              <ul className="mt-6 space-y-4" aria-label="Leads by channel">
                {byChannel.map((c, i) => (
                  <ChannelBar key={c.channel} channel={c.channel} n={c.n} total={channelTotal} index={i} />
                ))}
              </ul>
            )}
          </Card>
        </section>
      )}
    </div>
  );
}

function ChannelBar({ channel, n, total, index }: { channel: Channel; n: number; total: number; index: number }) {
  const pct = Math.round((n / total) * 100);
  return (
    <li className="text-sm">
      <div className="flex items-center justify-between gap-3">
        <span>{CHANNEL_LABEL[channel]}</span>
        <span className="tabular font-mono text-label text-ink-muted">
          {fmtCount(n)}, {pct}%
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-raised" role="img" aria-label={`${CHANNEL_LABEL[channel]}: ${pct} percent`}>
        <div className="animate-grow-x h-full rounded-full bg-brand" style={{ width: `${pct}%`, animationDelay: `${index * 90}ms` }} />
      </div>
    </li>
  );
}
