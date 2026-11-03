import type { Metadata } from "next";
import Link from "next/link";
import { FileText, Mail, MessageCircle, MessageSquare, Phone } from "lucide-react";
import { pageCount, parseCursor, PAGE_SIZE, type Channel } from "@alevo/db";
import { getCurrentOrg, withOrg } from "@alevo/auth";
import { buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { cursorHref, Pager } from "@/components/ui/pager";
import { Pill } from "@/components/ui/pill";
import { EmptyRow, Table, Td, Th, Tr } from "@/components/ui/table";
import { clientCount, clientsPage } from "@/lib/clients/queries";
import { cx } from "@/lib/cx";
import { displayName, fmtShort } from "@/lib/format";
import { getOrgTimezone } from "@/lib/org-timezone";
import { CHANNEL_LABEL, CONVERSATION_STATUS } from "@/lib/ui/status";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Conversations" };

const CHANNEL_ICON: Record<Channel, typeof Phone> = { form: FileText, email: Mail, sms: MessageSquare, chat: MessageCircle, voice: Phone };

/**
 * Conversations, organised by client: one row per contact, most recent activity
 * first. A row opens the client page with every conversation that person has had.
 * Explicit org id on every read: platform admins bypass RLS.
 */
export default async function ConversationsPage({ searchParams }: { searchParams: Promise<{ cursor?: string }> }) {
  const [cursor, org, tz] = await Promise.all([parseCursor((await searchParams).cursor), getCurrentOrg(), getOrgTimezone()]);
  if (!org) return null;
  const [page, total] = await Promise.all([withOrg((tx) => clientsPage(tx, org.id, cursor)), withOrg((tx) => clientCount(tx, org.id))]);

  return (
    <div className="space-y-8">
      <PageHeader title="Conversations" description={`${total} clients across your channels. Most recent first, ${PAGE_SIZE} per page.`}>
        <a href={`/form/${org.id}`} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary")}>
          Open lead form
        </a>
      </PageHeader>

      <Card padding="none">
        <Table>
          <thead>
            <tr>
              <Th>Client</Th>
              <Th>Channels</Th>
              <Th>Latest</Th>
              <Th className="text-right">Fit</Th>
              <Th className="text-right">Open</Th>
              <Th>Last activity</Th>
            </tr>
          </thead>
          <tbody>
            {page.rows.length === 0 ? (
              <EmptyRow colSpan={6}>
                {cursor ? (
                  <>
                    This page is empty — the list has changed since this link was made. <Link href="/conversations">Go to page 1</Link>.
                  </>
                ) : (
                  "No clients yet. Submit your lead form to create one."
                )}
              </EmptyRow>
            ) : (
              page.rows.map((r) => {
                const status = r.latestStatus ? CONVERSATION_STATUS[r.latestStatus] : null;
                const anonymous = r.channels.length === 1 && r.channels[0] === "chat" ? "Website visitor" : r.channels.includes("voice") ? "Unknown caller" : "New client";
                return (
                  <Tr key={r.id}>
                    <Td>
                      <Link href={`/conversations/client/${r.id}`} transitionTypes={["nav-forward"]} className="block font-semibold text-ink no-underline hover:underline">
                        {displayName(r.firstName, r.lastName, r.email ?? r.phone ?? anonymous)}
                      </Link>
                      <span className="block text-label text-ink-muted">{r.company ?? r.email ?? ""}</span>
                    </Td>
                    <Td>
                      <span className="flex items-center gap-1.5 text-ink-muted">
                        {r.channels.length === 0 && <span className="text-label">No conversations</span>}
                        {r.channels.map((ch) => {
                          const Icon = CHANNEL_ICON[ch];
                          return <Icon key={ch} className="size-4" strokeWidth={1.75} aria-label={CHANNEL_LABEL[ch]} role="img" />;
                        })}
                      </span>
                    </Td>
                    <Td>{status ? <Pill tone={status.tone}>{status.label}</Pill> : <span className="text-label text-ink-muted">—</span>}</Td>
                    <Td className="tabular text-right font-mono text-ink-muted">{r.maxFit ?? "—"}</Td>
                    <Td className={cx("tabular text-right font-mono", r.openCount ? "text-ink" : "text-ink-muted")}>{r.openCount}</Td>
                    <Td className="tabular font-mono text-label text-ink-muted">{fmtShort(r.lastActivityAt, tz)}</Td>
                  </Tr>
                );
              })
            )}
          </tbody>
        </Table>
        <Pager prev={page.newer} next={page.older} page={page.page} pages={pageCount(total)} href={cursorHref("/conversations")} />
      </Card>
    </div>
  );
}
