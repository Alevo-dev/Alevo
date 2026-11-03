import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getCurrentOrg, withOrg } from "@alevo/auth";
import { Card, CardTitle } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { Pill } from "@/components/ui/pill";
import { EmptyRow, Table, Td, Th, Tr } from "@/components/ui/table";
import { CLIENT_CONVERSATIONS_CAP, clientDetail } from "@/lib/clients/detail";
import { anonymousLabel, displayName, fmtDate, fmtDuration, fmtShort } from "@/lib/format";
import { getOrgTimezone } from "@/lib/org-timezone";
import { CALL_OUTCOME, CHANNEL_LABEL, CONVERSATION_STATUS } from "@/lib/ui/status";
import type { CallOutcome } from "@alevo/db";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function load(contactId: string) {
  if (!UUID.test(contactId)) return null;
  const org = await getCurrentOrg();
  if (!org) return null;
  return withOrg((tx) => clientDetail(tx, org.id, contactId));
}

export async function generateMetadata({ params }: { params: Promise<{ contactId: string }> }): Promise<Metadata> {
  const d = await load((await params).contactId);
  const c = d?.contact;
  return { title: c ? displayName(c.firstName, c.lastName, c.email ?? c.phone ?? "Client") : "Page not found" };
}

/** One client: who they are and every conversation they have had, across channels. */
export default async function ClientPage({ params }: { params: Promise<{ contactId: string }> }) {
  const [d, tz] = await Promise.all([load((await params).contactId), getOrgTimezone()]);
  if (!d) notFound();
  const { contact, conversations: convs } = d;
  const firstChannel = convs.at(-1)?.channel ?? null;
  const name = displayName(contact.firstName, contact.lastName, contact.email ?? contact.phone ?? anonymousLabel(firstChannel) ?? "Client");

  return (
    <div className="space-y-8">
      <div>
        <Link href="/conversations" transitionTypes={["nav-back"]} className="inline-flex items-center gap-1 text-label text-ink-muted no-underline hover:text-ink">
          <ChevronLeft className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
          Conversations
        </Link>
        <div className="mt-2">
          <PageHeader title={name} description={contact.company ?? undefined} />
        </div>
      </div>

      {d.suppressed && (
        <Notice tone="danger">This client opted out ({d.suppressed}). The agent won&apos;t email them; replies are recorded only.</Notice>
      )}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card padding="none" className="order-2 lg:order-1">
          <Table>
            <thead>
              <tr>
                <Th>Channel</Th>
                <Th>Status</Th>
                <Th className="text-right">Fit</Th>
                <Th>Started</Th>
                <Th>Last entry</Th>
              </tr>
            </thead>
            <tbody>
              {convs.length === 0 ? (
                <EmptyRow colSpan={5}>No conversations yet.</EmptyRow>
              ) : (
                convs.map((c) => {
                  const status = CONVERSATION_STATUS[c.status];
                  const outcome = c.callOutcome ? CALL_OUTCOME[c.callOutcome as CallOutcome] : null;
                  return (
                    <Tr key={c.id}>
                      <Td>
                        <Link href={`/conversations/${c.id}`} transitionTypes={["nav-forward"]} className="font-semibold text-ink no-underline hover:underline">
                          {CHANNEL_LABEL[c.channel]}
                        </Link>
                        {c.channel === "voice" && (
                          <span className="block text-label text-ink-muted">
                            {fmtDuration(c.callDurationSec)}
                            {outcome ? ` · ${outcome.label}` : ""}
                          </span>
                        )}
                      </Td>
                      <Td>
                        <Pill tone={status.tone}>{status.label}</Pill>
                      </Td>
                      <Td className="tabular text-right font-mono text-ink-muted">{c.fitScore ?? "—"}</Td>
                      <Td className="tabular font-mono text-label text-ink-muted">{fmtShort(c.createdAt, tz)}</Td>
                      <Td className="max-w-[320px]">
                        <span className="block tabular font-mono text-label text-ink-muted">{fmtShort(c.lastEntryAt, tz)}</span>
                        {c.lastPreview && <span className="block truncate text-sm text-ink-muted">{c.lastPreview}</span>}
                      </Td>
                    </Tr>
                  );
                })
              )}
            </tbody>
          </Table>
          {d.capped && <p className="px-5 py-3 text-label text-ink-muted">Showing the newest {CLIENT_CONVERSATIONS_CAP} conversations.</p>}
        </Card>

        <aside className="order-1 flex flex-col gap-6 lg:order-2 lg:border-l lg:border-hairline lg:pl-6">
          <div>
            <CardTitle>Contact</CardTitle>
            <dl className="mt-3 grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-x-4 gap-y-3 text-sm">
              <dt className="text-ink-muted">Email</dt>
              <dd className="truncate">{contact.email ?? "—"}</dd>
              <dt className="text-ink-muted">Phone</dt>
              <dd className="font-mono text-label">{contact.phone ?? "—"}</dd>
              <dt className="text-ink-muted">Company</dt>
              <dd>{contact.company ?? "—"}</dd>
              <dt className="text-ink-muted">First seen via</dt>
              <dd>{contact.source ? (CHANNEL_LABEL[contact.source as keyof typeof CHANNEL_LABEL] ?? contact.source) : "—"}</dd>
              <dt className="text-ink-muted">Client since</dt>
              <dd>{fmtDate(contact.createdAt, tz)}</dd>
              <dt className="text-ink-muted">Consent on file</dt>
              <dd>{d.consents.length ? d.consents.map((c) => CHANNEL_LABEL[c]).join(", ") : "None"}</dd>
            </dl>
          </div>
        </aside>
      </div>
    </div>
  );
}
