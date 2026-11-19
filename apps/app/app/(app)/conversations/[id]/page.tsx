import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarCheck } from "lucide-react";
import { Fragment } from "react";
import { and, asc, count, desc, eq, isNull, ne, sql } from "drizzle-orm";
import { calls, consents, contacts, conversationSpend, conversations, emailSuppressions, meetings, messages, orgProfiles, type CallOutcome } from "@alevo/db";
import { getCurrentRole, getCurrentUser, withOrg } from "@alevo/auth";
import { CrumbTail } from "@/components/crumbs";
import { CallCard } from "@/components/conversations/call-card";
import { Panel, ScreenHeader, Strip, TabLinks } from "@/components/conversations/kit";
import { RefreshButton } from "@/components/conversations/refresh-button";
import { buttonClass } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { Pill } from "@/components/ui/pill";
import { cx } from "@/lib/cx";
import { anonymousLabel, dayKey, dayLabel, displayName, fmtDateTime, fmtDuration, fmtShort, fmtTime } from "@/lib/format";
import { getOrgTimezone } from "@/lib/org-timezone";
import { linkedRecords } from "@/lib/psa/writeback";
import { CHANNEL_LABEL, CONVERSATION_STATUS, MEETING_STATUS, PROVIDER_LABEL } from "@/lib/ui/status";
import { ManageControls, OutcomeControls } from "../../meetings/meetings-ui";
import { ReplyAsContact } from "./reply-ui";
import { AutoRefresh } from "./auto-refresh";
import { FitScore } from "./fit-score";
import { PsaPanel } from "./psa-panel";
import { ThreadActions } from "./thread-actions";

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

const usd = (n: number) => (n < 1 ? `$${n.toFixed(4)}` : `$${n.toFixed(2)}`);

const AUTHOR_LABEL ={ contact: "Contact", assistant: "Alevo agent", human: "Rep" } as const;

export default async function ConversationThread({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
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
        firstReplySentAt: conversations.firstReplySentAt,
        leadReceivedAt: conversations.leadReceivedAt,
        firstName: contacts.firstName,
        lastName: contacts.lastName,
        email: contacts.email,
        phone: contacts.phone,
        company: contacts.company,
        timezone: contacts.timezone,
        contactPreference: contacts.contactPreference,
      })
      .from(conversations)
      .innerJoin(contacts, eq(contacts.id, conversations.contactId))
      .where(and(eq(conversations.id, id), sql`${conversations.orgId} = ${inOrg}`))
      .limit(1),
  );

  // Wrong id, or another org's conversation (RLS + the explicit filter hide it).
  if (!conv) notFound();

  const [tz, threadRows, [profile], meetingRows, psa, callRows, role, me, others, [consent]] = await Promise.all([
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
          model: messages.model,
        })
        .from(messages)
        .where(and(eq(messages.conversationId, id), sql`${messages.orgId} = ${inOrg}`))
        .orderBy(asc(messages.createdAt)),
    ),
    // Whether the Qualifier will actually reply (scoped to the active org).
    withOrg((tx) =>
      tx.select({ enabled: orgProfiles.enabled }).from(orgProfiles).where(sql`${orgProfiles.orgId} = ${inOrg}`).limit(1),
    ),
    // The meetings booked from this conversation, latest first.
    withOrg((tx) =>
      tx
        .select({ id: meetings.id, provider: meetings.provider, status: meetings.status, outcome: meetings.outcome, converted: meetings.converted, startAt: meetings.startAt, joinUrl: meetings.joinUrl, createdAt: meetings.createdAt })
        .from(meetings)
        .where(and(eq(meetings.conversationId, id), sql`${meetings.orgId} = ${inOrg}`))
        .orderBy(desc(meetings.createdAt))
        .limit(20),
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
    getCurrentUser(),
    // The client's other conversations (any channel), for the aside link.
    withOrg((tx) =>
      tx
        .select({ n: count() })
        .from(conversations)
        .where(and(eq(conversations.contactId, conv.contactId), sql`${conversations.orgId} = ${inOrg}`, ne(conversations.id, id))),
    ),
    // Where the contact's consent came from (newest active one).
    withOrg((tx) =>
      tx
        .select({ source: consents.source })
        .from(consents)
        .where(and(eq(consents.contactId, conv.contactId), eq(consents.orgId, conv.orgId), isNull(consents.revokedAt)))
        .orderBy(desc(consents.grantedAt))
        .limit(1),
    ),
  ]);
  // Which AI model wrote each reply, and what the AI calls cost, are for Alevo staff only (testing and knowledge),
  // never a client: the model is dropped here before anything is rendered.
  const staff = me?.isPlatformAdmin === true;
  const thread = threadRows.map((m) => ({ ...m, model: staff ? m.model : null }));
  const aiSpend = staff ? await conversationSpend(conv.orgId, conv.id) : [];
  const meeting = meetingRows[0];
  const canAct = role === "rep" || role === "admin" || role === "owner";
  const tab = sp.tab === "calls" && callRows.length > 0 ? "calls" : sp.tab === "meetings" && meetingRows.length > 0 ? "meetings" : "thread";
  const tabHref = (t: string) => (t === "thread" ? `/conversations/${id}` : `/conversations/${id}?tab=${t}`);
  const otherCount = others[0]?.n ?? 0;
  const qualifierEnabled = profile?.enabled ?? false;
  const canDelete = role === "admin" || role === "owner";
  const canPlay = canDelete;

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
  const isOpen = ["new", "active"].includes(conv.status);

  // Poll for the Qualifier's async reply only when it's actually on, a contact
  // message is the latest turn, and the conversation is still being worked.
  const lastMsg = thread.at(-1);
  const awaitingReply = qualifierEnabled && lastMsg?.author === "contact" && isOpen;

  const firstReply = conv.firstReplySentAt && conv.leadReceivedAt ? (conv.firstReplySentAt.getTime() - conv.leadReceivedAt.getTime()) / 1000 : null;
  const channel = CHANNEL_LABEL[conv.channel];
  const ls = CONVERSATION_STATUS[conv.status];
  const reasons = (conv.scoreReasons ?? "")
    .split(/(?<=[.;])\s+/)
    .map((r) => r.trim())
    .filter(Boolean);
  const timeline = [
    { at: conv.createdAt, text: `First touch by ${channel.toLowerCase()}` },
    ...(meeting ? [{ at: meeting.createdAt, text: meeting.startAt ? `Meeting booked for ${fmtDateTime(meeting.startAt, tz)}` : "Meeting booked" }] : []),
    ...psa.slice(-1).map((r) => ({ at: r.createdAt, text: "Written to ConnectWise" })),
  ].sort((a, b) => a.at.getTime() - b.at.getTime());
  const firstAgentId = thread.find((m) => m.author === "assistant")?.id;

  return (
    <div className="flex flex-col gap-3.5">
      <CrumbTail items={[{ label: "Client", href: `/conversations/client/${conv.contactId}` }, { label: "Conversation" }]} />
      <ScreenHeader title={conv.company ?? name} badge={<Pill tone={ls.tone}>{ls.label}</Pill>} sub={conv.company ? name : undefined}>
        <Link href={`/conversations/client/${conv.contactId}`} transitionTypes={["nav-back"]} className={buttonClass("secondary", "sm")}>
          Open client
        </Link>
        <ThreadActions conversationId={conv.id} status={conv.status} canAct={canAct} canDelete={canDelete} />
      </ScreenHeader>

      <Strip
        items={[
          { k: "Client", v: name },
          { k: "Channel", v: channel },
          { k: "Status", v: ls.label },
          { k: "Fit", v: <span className="font-mono">{conv.fitScore ?? "—"}</span> },
          { k: "First reply", v: <span className="font-mono">{firstReply == null ? "—" : fmtDuration(firstReply)}</span> },
          { k: "Started", v: fmtShort(conv.createdAt, tz) },
        ]}
      />

      {conv.replyFailedAt && (
        <Notice tone="danger">
          The agent could not complete its last reply
          {conv.replyError ? ` (${conv.replyError.toLowerCase()})` : ""}. Reach out to this contact yourself; the notice clears once a reply goes through.
        </Notice>
      )}

      {suppressedReason && (
        <Notice tone="danger">
          This contact opted out ({suppressedReason}). The agent won&apos;t email them; replies are recorded here only.
        </Notice>
      )}

      {(callRows.length > 0 || meetingRows.length > 0) && (
        <TabLinks
          label="Conversation sections"
          tabs={[
            { label: "Thread", href: tabHref("thread"), active: tab === "thread" },
            ...(callRows.length > 0 ? [{ label: "Calls", href: tabHref("calls"), count: callRows.length, active: tab === "calls" }] : []),
            ...(meetingRows.length > 0 ? [{ label: "Meetings", href: tabHref("meetings"), count: meetingRows.length, active: tab === "meetings" }] : []),
          ]}
        />
      )}

      <div className="grid items-start gap-3.5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <Card boxed padding="none" aria-label={tab === "meetings" ? "Meetings" : "Messages"}>
          <CardHeader title={tab === "thread" ? "Thread" : tab === "calls" ? "Calls" : "Meetings"} hint={`${channel} · started ${fmtTime(conv.createdAt, tz)}`} aside={<RefreshButton label="Refresh" />} />
          {tab === "thread" && aiSpend.length > 0 && (
            <p className="border-b border-hairline bg-sunken px-4 py-2 font-mono text-xs text-ink-muted">
              <span className="font-semibold text-violet-ink">Alevo staff only</span>
              {" · AI: "}
              {aiSpend.map((s) => `${s.model} ${s.calls} ${s.calls === 1 ? "call" : "calls"}, ${usd(s.costUsd)}`).join(" · ")}
            </p>
          )}
          {tab === "meetings" ? (
            <ul>
              {meetingRows.map((m) => {
                const ms = MEETING_STATUS[m.status];
                return (
                  <li key={m.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-hairline/60 px-4 py-3 first:border-t-0">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="font-mono text-sm font-semibold">{m.startAt ? fmtDateTime(m.startAt, tz) : "Time to be set"}</span>
                        <Pill tone={ms.tone}>{ms.label}</Pill>
                      </div>
                      <div className="mt-0.5 text-[13px] text-ink-muted">
                        With {name} · {PROVIDER_LABEL[m.provider]}
                        {m.joinUrl && (
                          <>
                            {" · "}
                            <a href={m.joinUrl} target="_blank" rel="noopener noreferrer">
                              Join link
                            </a>
                          </>
                        )}
                      </div>
                    </div>
                    {canAct && <OutcomeControls id={m.id} status={m.status} outcome={m.outcome} converted={m.converted} />}
                    {canAct && <ManageControls id={m.id} provider={m.provider} status={m.status} contact={name} />}
                  </li>
                );
              })}
            </ul>
          ) : (
            <>
              <ol className="flex flex-col gap-3 p-3.5">
                {entries.length === 0 && <li className="text-sm text-ink-muted">No messages yet.</li>}
                {entries.filter((e) => tab === "thread" || e.kind === "call").map((e, i, shown) => {
                  // A day divider like WhatsApp, so a reply a day later never reads as minutes later.
                  const day = dayKey(e.at, tz);
                  const divider = i === 0 || day !== dayKey(shown[i - 1]!.at, tz) ? (
                    <li key={`day-${day}`} className="self-center rounded-full border border-hairline bg-raised px-3 py-0.5 font-mono text-xs text-ink-muted">
                      {dayLabel(e.at, tz)}
                    </li>
                  ) : null;
                  if (e.kind === "call") {
                    const c = e.c;
                    return (
                      <Fragment key={c.id}>
                        {divider}
                        <CallCard
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
                      </Fragment>
                    );
                  }
                  const m = e.m;
                  const fromContact = m.author === "contact";
                  return (
                    <Fragment key={m.id}>
                    {divider}
                    <li className={cx("flex max-w-[78%] flex-col", fromContact ? "self-start" : "ml-auto items-end self-end")}>
                      <div className="mb-[3px] font-mono text-xs text-ink-muted">
                        {fromContact ? name : AUTHOR_LABEL[m.author]} · {channel} {fmtTime(m.createdAt, tz)}
                        {m.id === firstAgentId && firstReply != null ? ` · ${fmtDuration(firstReply)}` : ""}
                        {m.model ? <span className="text-violet-ink"> · {m.model}</span> : null}
                      </div>
                      <div
                        className={cx(
                          "whitespace-pre-wrap border px-3 py-2 text-sm leading-[21px] text-ink",
                          fromContact ? "rounded-[10px_10px_10px_2px] border-hairline bg-raised" : "rounded-[10px_10px_2px_10px] border-brand/50 bg-brand-soft",
                        )}
                      >
                        {m.body}
                      </div>
                    </li>
                    </Fragment>
                  );
                })}
              </ol>
              {tab === "thread" && meeting && (
                <div className="mx-3.5 mb-3.5 flex items-start gap-2.5 rounded-sm border border-brand/60 bg-brand/[0.07] px-3 py-[9px] text-[13.5px] text-brand-ink">
                  <CalendarCheck className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                  <div>
                    <b className="font-semibold">{MEETING_STATUS[meeting.status].label}</b>
                    {" · "}
                    {meeting.startAt ? fmtDateTime(meeting.startAt, tz) : "Time to be set"}
                    {meeting.joinUrl && (
                      <>
                        {" · "}
                        <a href={meeting.joinUrl} target="_blank" rel="noopener noreferrer">
                          Join link
                        </a>
                      </>
                    )}
                  </div>
                </div>
              )}
              {tab === "thread" && <ReplyAsContact conversationId={conv.id} qualifierEnabled={qualifierEnabled} />}
              <AutoRefresh key={lastMsg?.id} active={!!awaitingReply} />
            </>
          )}
        </Card>

        <aside aria-label="Lead details" className="flex min-w-0 flex-col gap-3.5">
          <Panel title="Fit score">
            <FitScore score={conv.fitScore} />
            {reasons.length > 0 && (
              <ul className="mt-3 list-disc pl-[18px] leading-5 text-ink-muted">
                {reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Details">
            <dl>
              <Row k="Email">{conv.email ?? "—"}</Row>
              <Row k="Phone">{conv.phone ? <span className="font-mono">{conv.phone}</span> : "—"}</Row>
              <Row k="Company">{conv.company ?? "—"}</Row>
              <Row k="Prefers">{conv.contactPreference === "text" ? "Text message" : conv.contactPreference === "email" ? "Email" : "—"}</Row>
              <Row k="Timezone">{conv.timezone ?? "—"}</Row>
              <Row k="Consent source">{consent?.source ?? "—"}</Row>
              <Row k="Other conversations">
                {otherCount === 0 ? (
                  "None"
                ) : (
                  <Link href={`/conversations/client/${conv.contactId}`} transitionTypes={["nav-back"]}>
                    {otherCount} more
                  </Link>
                )}
              </Row>
            </dl>
          </Panel>

          <PsaPanel records={psa} tz={tz} />

          <Panel title="Timeline">
            <ol className="flex flex-col gap-2">
              {timeline.map((t) => (
                <li key={t.text}>
                  <span className="mr-2.5 font-mono text-ink-muted">{fmtTime(t.at, tz)}</span>
                  {t.text}
                </li>
              ))}
            </ol>
          </Panel>
        </aside>
      </div>
    </div>
  );
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 border-b border-hairline/60 py-1.5 first:pt-0 last:border-b-0 last:pb-0">
      <dt className="text-ink-muted">{k}</dt>
      <dd className="min-w-0 truncate">{children}</dd>
    </div>
  );
}
