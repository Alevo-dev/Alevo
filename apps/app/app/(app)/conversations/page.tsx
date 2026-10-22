import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { contacts, conversations } from "@alevo/db";
import { getCurrentOrg, withOrg } from "@alevo/auth";
import { buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Pill } from "@/components/ui/pill";
import { EmptyRow, Table, Td, Th, Tr } from "@/components/ui/table";
import { displayName, fmtDateTime, tzLabel } from "@/lib/format";
import { getOrgTimezone } from "@/lib/org-timezone";
import { CHANNEL_LABEL, CONVERSATION_STATUS } from "@/lib/ui/status";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Conversations" };

export default async function ConversationsPage() {
  // All three are independent: one round trip. (Explicit active-org scope on
  // the list — platform admins bypass RLS.)
  const [org, tz, rows] = await Promise.all([
    getCurrentOrg(),
    getOrgTimezone(),
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
      .where(sql`${conversations.orgId} = (select app.current_org_id())`)
      .orderBy(desc(conversations.createdAt)),
    ),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader title="Conversations" description={`${rows.length} leads across your channels`}>
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
            {rows.length === 0 ? (
              <EmptyRow colSpan={5}>No conversations yet. Submit your lead form to create one.</EmptyRow>
            ) : (
              rows.map((c) => {
                const status = CONVERSATION_STATUS[c.status];
                return (
                  <Tr key={c.id}>
                    <Td>
                      <Link
                        href={`/conversations/${c.id}`}
                        transitionTypes={["nav-forward"]}
                        className="block font-semibold text-ink no-underline hover:underline"
                      >
                        {displayName(c.firstName, c.lastName, c.email)}
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
      </Card>
    </div>
  );
}
