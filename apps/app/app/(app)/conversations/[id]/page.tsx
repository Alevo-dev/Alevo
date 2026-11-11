import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { and, asc, count, desc, eq, ne, sql } from "drizzle-orm";
import { calls, contacts, conversations, emailSuppressions, meetings, messages, orgProfiles, type CallOutcome } from "@alevo/db";
import { getCurrentRole, withOrg } from "@alevo/auth";
import { CallCard } from "@/components/conversations/call-card";
import { CardTitle } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { Pill, StatusDot } from "@/components/ui/pill";
import { cx } from "@/lib/cx";
import { anonymousLabel, displayName, fmtDateTime, fmtTime } from "@/lib/format";
import { getOrgTimezone } from "@/lib/org-timezone";
import { linkedRecords } from "@/lib/psa/writeback";
import { CHANNEL_LABEL, CONVERSATION_STATUS, MEETING_STATUS } from "@/lib/ui/status";
import { ReplyAsContact } from "./reply-ui";
import { AutoRefresh } from "./auto-refresh";
import { FitScore } from "./fit-score";
import { PsaPanel } from "./psa-panel";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const [row] = await withOrg((tx) =>
    tx
      .select({ firstName: contacts.firstName, lastName: contacts.lastName, email: contacts.email, phone: contacts.phone, channel: conversations.channel })
      .from(conversations)
      .innerJoin(contacts, eq(contacts.id, conversations.contactId))
      .where(and(eq(conversations.id, id), sql`${conversations.orgId} = (select app.current_org_id())`))
      .limit(1),
  );
  return { title: row ? displayName(row.firstName, row.lastName, row.email ?? row.phone ?? anonymousLabel(row.channel)) : "Page not found" };
}

const AUTHOR_LABEL = { contact: "Contact", assistant: "Alevo agent", human: "Rep" } as const;

export default async function ConversationThread({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const inOrg = sql`(select app.current_org_id())`;

  const [conv] = await withOrg((tx) =>
    tx
      .select({
        id: conversations.id,
        orgId: conversations.orgId,
        contactId: conversations.contactId,
        status: conversations.status,
        channel: conversations.channel,
        fitScore: conversations.fitScore,
        scoreReasons: conversations.scoreReasons,
        replyFailedAt: conversations.replyFailedAt,
        replyError: conversations.replyError,
        createdAt: conversations.createdAt,
        firstName: contacts.firstName,
        lastName: contacts.lastName,
        email: contacts.email,
        phone: contacts.phone,
        company: contacts.company,
      })
      .from(conversations)
      .innerJoin(contacts, eq(contacts.id, conversations.contactId))
      .where(and(eq(conversations.id, id), sql`${conversations.orgId} = ${inOrg}`))
      .limit(1),
  );

  // Wrong id, or another org's conversation (RLS + the explicit filter hide it).
  if (!conv) notFound();

  const [tz, thread, [profile], [meeting], psa, callRows, role, others] = await Promise.all([
    getOrgTimezone(),
    withOrg((tx) =>
      tx
        .select({
          id: messages.id,
          direction: messages.direction,
          author: messages.author,
          body: messages.body,
          createdAt: messages.createdAt,
          providerRef: messages.providerRef,
        })
        .from(messages)
        .where(and(eq(messages.conversationId, id), sql`${messages.orgId} = ${inOrg}`))
        .orderBy(asc(messages.createdAt)),
    ),
    // Whether the Qualifier will actually reply (scoped to the active org).
    withOrg((tx) =>
      tx.select({ enabled: orgProfiles.enabled }).from(orgProfiles).where(sql`${orgProfiles.orgId} = ${inOrg}`).limit(1),
    ),
    // The booked meeting for this conversation (latest), if any.
    withOrg((tx) =>
      tx
        .select({ status: meetings.status, startAt: meetings.startAt, joinUrl: meetings.joinUrl })
        .from(meetings)
        .where(and(eq(meetings.conversationId, id), sql`${meetings.orgId} = ${inOrg}`))
        .orderBy(desc(meetings.createdAt))
        .limit(1),
    ),
    // What was written back to the PSA for this lead (explicit org filter).
    withOrg((tx) => linkedRecords(tx, conv.orgId, conv.id, conv.contactId)),
    // The phone calls in this thread (one conversation per call, so usually one).
    withOrg((tx) =>
      tx
        .select({
          id: calls.id,
          providerRef: calls.providerRef,
          startedAt: calls.startedAt,
          createdAt: calls.createdAt,
          durationSec: calls.durationSec,
          outcome: calls.outcome,
          summary: calls.summary,
          transcript: calls.transcript,
          recordingKey: calls.recordingKey,
        })
        .from(calls)
        .where(and(eq(calls.conversationId, id), sql`${calls.orgId} = ${inOrg}`)),
    ),
    getCurrentRole(),
    // The client's other conversations (any channel), for the aside link.
    withOrg((tx) =>
      tx
        .select({ n: count() })
        .from(conversations)
        .where(and(eq(conversations.contactId, conv.contactId), sql`${conversations.orgId} = ${inOrg}`, ne(conversations.id, id))),
    ),
  ]);
  const otherCount = others[0]?.n ?? 0;
  const qualifierEnabled = profile?.enabled ?? false;
  const canPlay = role === "admin" || role === "owner";

  // Messages and calls in one timeline, oldest first.
  type Entry = { at: Date } & ({ kind: "message"; m: (typeof thread)[number] } | { kind: "call"; c: (typeof callRows)[number] });
  const entries: Entry[] = [
    ...thread.map((m) => ({ kind: "message" as const, at: m.createdAt, m })),
    ...callRows.map((c) => ({ kind: "call" as const, at: c.startedAt ?? c.createdAt, c })),
  ].sort((a, b) => a.at.getTime() - b.at.getTime());

  // Is this contact's email suppressed? (unsubscribe / bounce / complaint)
  let suppressedReason: string | null = null;
  if (conv.email) {
    const [row] = await withOrg((tx) =>
      tx
        .select({ reason: emailSuppressions.reason })
        .from(emailSuppressions)
        .where(
          and(
            sql`${emailSuppressions.orgId} = ${inOrg}`,
            sql`lower(${emailSuppressions.email}) = ${conv.email!.toLowerCase()}`,
          ),
        )
        .limit(1),
    );
    suppressedReason = row?.reason ?? null;
  }

  const name = displayName(conv.firstName, conv.lastName, conv.email ?? conv.phone ?? anonymousLabel(conv.channel));
  const status = CONVERSATION_STATUS[conv.status];
  const isOpen = ["new", "active"].includes(conv.status);

  // Poll for the Qualifier's async reply only when it's actually on, a contact
  // message is the latest turn, and the conversation is still being worked.
  const lastMsg = thread.at(-1);
  const awaitingReply = qualifierEnabled && lastMsg?.author === "contact" && isOpen;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_420px]">
      <section aria-label="Messages" className="flex min-w-0 flex-col gap-6">
        <header className="border-b border-hairline pb-5">
          <Link href="/conversations" transitionTypes={["nav-back"]} className="inline-flex items-center gap-1 text-label text-ink-muted no-underline hover:text-ink">
            <ChevronLeft className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
            Conversations
          </Link>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              <h1 className="truncate text-title font-semibold text-ink">
                <Link href={`/conversations/client/${conv.contactId}`} transitionTypes={["nav-back"]} className="text-ink no-underline hover:underline">
                  {name}
                </Link>
              </h1>
              <p className="mt-2 flex items-center gap-2 text-sm text-ink-muted">
                <StatusDot tone={status.tone} live={isOpen && qualifierEnabled} />
                {conv.company ? `${conv.company}. ` : ""}Started by {CHANNEL_LABEL[conv.channel].toLowerCase()} at{" "}
                {fmtDateTime(conv.createdAt, tz)}
              </p>
            </div>
            <Pill tone={status.tone} className="px-3 py-1.5 text-sm">
              {status.label}
            </Pill>
          </div>
        </header>

        {conv.replyFailedAt && (
          <Notice tone="danger">
            The agent could not complete its last reply
            {conv.replyError ? ` (${conv.replyError.toLowerCase()})` : ""}. Reach out to this contact yourself; the
            notice clears once a reply goes through.
          </Notice>
        )}

        {suppressedReason && (
          <Notice tone="danger">
            This contact opted out ({suppressedReason}). The agent won&apos;t email them; replies are recorded
            here only.
          </Notice>
        )}

        <ol className="flex flex-col gap-5">
          {entries.length === 0 && <li className="text-sm text-ink-muted">No messages yet.</li>}
          {entries.map((e) => {
            if (e.kind === "call") {
              const c = e.c;
              return (
                <CallCard
                  key={c.id}
                  tz={tz}
                  canPlay={canPlay}
                  call={{
                    id: c.id,
                    startedAt: c.startedAt,
                    durationSec: c.durationSec,
                    outcome: (c.outcome ?? "none") as CallOutcome,
                    summary: c.summary,
                    transcript: c.transcript,
                    hasRecording: Boolean(c.recordingKey),
                    messageTaken: thread.some((m) => m.providerRef === `call:${c.providerRef}:message`),
                  }}
                />
              );
            }
            const m = e.m;
            const fromContact = m.author === "contact";
            return (
              <li key={m.id} className={cx("flex max-w-[720px] flex-col", fromContact ? "self-start" : "self-end items-end")}>
                <div className="mb-1.5 text-label text-ink-muted">
                  {fromContact ? name : AUTHOR_LABEL[m.author]}, {fmtTime(m.createdAt, tz)}
                </div>
                <div
                  className={cx(
                    "whitespace-pre-wrap rounded-md p-4 text-base leading-6 text-ink",
                    fromContact && "bg-raised",
                    m.author === "assistant" && "border border-violet bg-violet-soft",
                    m.author === "human" && "border border-brand bg-brand-soft",
                  )}
                >
                  {m.body}
                </div>
              </li>
            );
          })}
        </ol>

        <ReplyAsContact conversationId={conv.id} qualifierEnabled={qualifierEnabled} />
        <AutoRefresh key={lastMsg?.id} active={!!awaitingReply} />
      </section>

      <aside aria-label="Lead details" className="flex flex-col gap-6 lg:border-l lg:border-hairline lg:pl-6">
        <FitScore score={conv.fitScore} />

        <dl className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-x-4 gap-y-3 text-sm">
          <dt className="text-ink-muted">Email</dt>
          <dd className="truncate">{conv.email ?? "—"}</dd>
          <dt className="text-ink-muted">Phone</dt>
          <dd className="font-mono text-label">{conv.phone ?? "—"}</dd>
          <dt className="text-ink-muted">Company</dt>
          <dd>{conv.company ?? "—"}</dd>
          <dt className="text-ink-muted">Channel</dt>
          <dd>{CHANNEL_LABEL[conv.channel]}</dd>
          <dt className="text-ink-muted">Client</dt>
          <dd>
            <Link href={`/conversations/client/${conv.contactId}`} transitionTypes={["nav-back"]}>
              {otherCount === 0 ? "No other conversations" : otherCount === 1 ? "1 other conversation" : `${otherCount} other conversations`}
            </Link>
          </dd>
        </dl>

        {conv.scoreReasons && (
          <div className="rounded-md bg-brand-soft p-4">
            <div className="text-sm font-semibold text-ink">Why the score</div>
            <p className="mt-2 text-sm leading-5 text-ink">{conv.scoreReasons}</p>
          </div>
        )}

        {meeting && (
          <div>
            <CardTitle>Meeting</CardTitle>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
              <Pill tone={MEETING_STATUS[meeting.status].tone}>{MEETING_STATUS[meeting.status].label}</Pill>
              <span className="tabular font-mono text-label text-ink-muted">
                {meeting.startAt ? fmtDateTime(meeting.startAt, tz) : "Time to be set"}
              </span>
            </div>
            {meeting.joinUrl && (
              <a href={meeting.joinUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-sm">
                Join link
              </a>
            )}
          </div>
        )}

        <PsaPanel records={psa} tz={tz} />
      </aside>
    </div>
  );
}
