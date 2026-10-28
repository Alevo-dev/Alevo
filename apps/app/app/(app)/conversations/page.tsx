import type { Metadata } from "next";
import Link from "next/link";
import { and, count, eq, sql } from "drizzle-orm";
import { contacts, conversations, finishPage, keysetOrder, keysetWhere, PAGE_SIZE, parseCursor } from "@alevo/db";
import { getCurrentOrg, withOrg } from "@alevo/auth";
import { buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { cursorHref, Pager } from "@/components/ui/pager";
import { Pill } from "@/components/ui/pill";
import { EmptyRow, Table, Td, Th, Tr } from "@/components/ui/table";
import { displayName, fmtDateTime, tzLabel } from "@/lib/format";
import { getOrgTimezone } from "@/lib/org-timezone";
import { CHANNEL_LABEL, CONVERSATION_STATUS } from "@/lib/ui/status";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Conversations" };

// Explicit active-org scope on every read: platform admins bypass RLS.
const ORG = sql`${conversations.orgId} = (select app.current_org_id())`;
const KEY = { at: conversations.createdAt, id: conversations.id };

export default async function ConversationsPage({ searchParams }: { searchParams: Promise<{ cursor?: string }> }) {
  const cursor = parseCursor((await searchParams).cursor);

  // All four are independent: one round trip. The list is one page (newest
  // first); the header count is its own cheap aggregate.
  const [org, tz, countRows, fetched] = await Promise.all([
    getCurrentOrg(),
    getOrgTimezone(),
    withOrg((tx) => tx.select({ total: count() }).from(conversations).where(ORG)),
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
          phone: contacts.phone,
          company: contacts.company,
        })
        .from(conversations)
        .innerJoin(contacts, eq(contacts.id, conversations.contactId))
        .where(and(ORG, keysetWhere(conversations, KEY, cursor)))
        .orderBy(...keysetOrder(KEY, cursor))
        .limit(PAGE_SIZE + 1),
    ),
  ]);
  const page = finishPage(fetched, cursor);
  const total = countRows[0]?.total ?? 0;

  return (
    <div className="space-y-8">
      <PageHeader title="Conversations" description={`${total} leads across your channels`}>
        {org && (
          <a href={`/f/${org.id}`} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary")}>
            Open lead form
          </a>
        )}
      </PageHeader>

      <Card padding="none">
        <Table>
          <thead>
            <tr>
              <Th>Contact</Th>
              <Th>Channel</Th>
              <Th>Status</Th>
              <Th className="text-right">Score</Th>
              <Th>Received ({tzLabel(tz)})</Th>
            </tr>
          </thead>
          <tbody>
            {page.rows.length === 0 ? (
              <EmptyRow colSpan={5}>
                {cursor ? (
                  <>
                    Nothing on this page. <Link href="/conversations">Back to the newest</Link>.
                  </>
                ) : (
                  "No conversations yet. Submit your lead form to create one."
                )}
              </EmptyRow>
            ) : (
              page.rows.map((c) => {
                const status = CONVERSATION_STATUS[c.status];
                return (
                  <Tr key={c.id}>
                    <Td>
                      <Link
                        href={`/conversations/${c.id}`}
                        transitionTypes={["nav-forward"]}
                        className="block font-semibold text-ink no-underline hover:underline"
                      >
                        {displayName(c.firstName, c.lastName, c.email ?? c.phone)}
                      </Link>
                      <span className="block text-label text-ink-muted">{c.company ?? c.email ?? ""}</span>
                    </Td>
                    <Td className="text-ink-muted">{CHANNEL_LABEL[c.channel]}</Td>
                    <Td>
                      <Pill tone={status.tone}>{status.label}</Pill>
                    </Td>
                    <Td className="tabular text-right font-mono text-ink-muted">{c.fitScore ?? "—"}</Td>
                    <Td className="tabular font-mono text-label text-ink-muted">{fmtDateTime(c.createdAt, tz)}</Td>
                  </Tr>
                );
              })
            )}
          </tbody>
        </Table>
        <Pager newer={page.newer} older={page.older} href={cursorHref("/conversations")} label={`${page.rows.length} of ${total}`} />
      </Card>
    </div>
  );
}
