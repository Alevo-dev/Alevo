import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Phone } from "lucide-react";
import { getCurrentOrg, getCurrentRole, withOrg } from "@alevo/auth";
import type { CallOutcome, Channel } from "@alevo/db";
import { CallCard } from "@/components/conversations/call-card";
import { CHANNEL_ICON, FitCard, FitMeter, Panel, ScreenHeader, Strip, TabLinks } from "@/components/conversations/kit";
import { buttonClass } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { Tabs } from "@/components/ui/nav-kit";
import { Pill } from "@/components/ui/pill";
import { EmptyRow, Table, Td, Th, Tr } from "@/components/ui/table";
import { CLIENT_CONVERSATIONS_CAP, clientDetail, type ClientConversation, type ClientDetail } from "@/lib/clients/detail";
import { CrumbTail } from "@/components/crumbs";
import { anonymousLabel, displayName, fmtDate, fmtDateTime, fmtDuration, fmtShort } from "@/lib/format";
import { getOrgTimezone } from "@/lib/org-timezone";
import { ClientNotFit } from "../../[id]/thread-actions";
import { ManageControls, OutcomeControls } from "../../../meetings/meetings-ui";
import { CALL_OUTCOME, CHANNEL_LABEL, CONVERSATION_STATUS, MEETING_STATUS, PROVIDER_LABEL } from "@/lib/ui/status";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TABS = ["overview", "conversations", "calls", "meetings", "psa"] as const;
type Tab = (typeof TABS)[number];
const MEETING_OUTCOME = { pending: "Pending", showed: "Showed", no_show: "No-show" } as const;
const PSA_KIND: Record<string, string> = {
  company: "Company",
  contact: "Contact",
  "activity:handed_off": "Activity: handed off",
  "activity:booked": "Activity: meeting booked",
  opportunity: "Opportunity",
};

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

/** One client: who they are and everything with them, across channels, in tabs (`?tab=`). */
export default async function ClientPage({
  params,
  searchParams,
}: {
  params: Promise<{ contactId: string }>;
  searchParams: Promise<{ tab?: string; show?: string }>;
}) {
  const [{ contactId }, sp, tz, role] = await Promise.all([params, searchParams, getOrgTimezone(), getCurrentRole()]);
  const d = await load(contactId);
  if (!d) notFound();
  const { contact, conversations: convs } = d;
  const base = `/conversations/client/${contactId}`;
  const tab: Tab = (TABS as readonly string[]).includes(sp.tab ?? "") ? (sp.tab as Tab) : "overview";
  const show = sp.show === "open" || sp.show === "closed" ? sp.show : "all";
  const canPlay = role === "admin" || role === "owner";
  const canAct = canPlay || role === "rep";
  const openCount = convs.filter((c) => c.status === "new" || c.status === "active").length;
  const clientName = displayName(contact.firstName, contact.lastName, contact.email ?? contact.phone ?? "this client");

  const firstChannel = convs.at(-1)?.channel ?? null;
  const name = displayName(contact.firstName, contact.lastName, contact.email ?? contact.phone ?? anonymousLabel(firstChannel) ?? "Client");
  const latest = convs[0];
  const latestStatus = latest ? CONVERSATION_STATUS[latest.status] : null;
  const bestFit = convs.reduce<number | null>((m, c) => (c.fitScore != null && (m == null || c.fitScore > m) ? c.fitScore : m), null);
  const source = contact.source ? (CHANNEL_LABEL[contact.source as Channel] ?? contact.source) : "—";

  const tabHref = (t: Tab) => (t === "overview" ? base : `${base}?tab=${t}`);
  const tabs = [
    { key: "overview", label: "Overview" },
    { key: "conversations", label: "Conversations", count: convs.length },
    { key: "calls", label: "Calls", count: d.calls.length },
    { key: "meetings", label: "Meetings", count: d.meetings.length },
    ...(d.psa.length ? [{ key: "psa", label: "PSA" }] : []),
  ] as { key: Tab; label: string; count?: number }[];

  return (
    <div className="flex flex-col gap-3.5">
      <CrumbTail items={[{ label: "Client" }]} />
      <ScreenHeader title={name} badge={latestStatus && <Pill tone={latestStatus.tone}>{latestStatus.label}</Pill>} sub={contact.company}>
        {bestFit != null && <FitCard score={bestFit} />}
        {latest && (
          <Link href={`/conversations/${latest.id}`} transitionTypes={["nav-forward"]} className={buttonClass("secondary", "sm")}>
            Open latest thread
          </Link>
        )}
        {canAct && <ClientNotFit contactId={contact.id} openCount={openCount} />}
      </ScreenHeader>

      <Strip
        items={[
          { k: "Email", v: contact.email ?? "—" },
          { k: "Phone", v: <span className="font-mono">{contact.phone ?? "—"}</span> },
          { k: "Company", v: contact.company ?? "—" },
          { k: "First seen", v: fmtDate(contact.createdAt, tz) },
          { k: "Source", v: source },
          { k: "Timezone", v: contact.timezone ?? "—" },
        ]}
      />

      {d.suppressed && <Notice tone="danger">This client opted out ({d.suppressed}). The agent won&apos;t email them; replies are recorded only.</Notice>}

      <TabLinks label="Client sections" tabs={tabs.map((t) => ({ label: t.label, href: tabHref(t.key), count: t.count, active: t.key === tab }))} />

      {tab === "overview" && (
        <div className="grid items-start gap-3.5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <div className="flex min-w-0 flex-col gap-3.5">
            <Panel title="Conversations" hint={`${convs.length} ${convs.length === 1 ? "thread" : "threads"} with this client`} flush>
              <Threads convs={convs.slice(0, 5)} tz={tz} />
              {convs.length > 5 && (
                <p className="border-t border-hairline px-3.5 py-2 text-[13px]">
                  <Link href={tabHref("conversations")}>All {convs.length} conversations</Link>
                </p>
              )}
            </Panel>
            {d.calls.length > 0 && (
              <Panel title="Calls" hint={canPlay ? undefined : "Recording plays for admins only"} flush>
                <ul>
                  {d.calls.slice(0, 3).map((c) => (
                    <CallRow key={c.id} call={c} tz={tz} />
                  ))}
                </ul>
              </Panel>
            )}
            {d.meetings.length > 0 && (
              <Panel title="Meetings" flush>
                <MeetingsTable meetings={d.meetings} tz={tz} name={clientName} canAct={canAct} compact />
              </Panel>
            )}
          </div>
          <div className="flex min-w-0 flex-col gap-3.5">
            {d.psa.length > 0 && (
              <Panel title="In ConnectWise">
                <PsaList psa={d.psa} tz={tz} />
              </Panel>
            )}
            <Panel title="Consent">
              <ul className="flex flex-col gap-2">
                {(["email", "sms", "voice"] as Channel[]).map((ch) => (
                  <li key={ch} className="flex items-center justify-between gap-3">
                    <span>
                      {ch === "voice" ? "Phone" : CHANNEL_LABEL[ch]}
                      {d.consentSources[ch] && <span className="ml-2 text-[13px] text-ink-muted">via {d.consentSources[ch]}</span>}
                    </span>
                    <Pill tone={d.consents.includes(ch) ? "success" : "muted"}>{d.consents.includes(ch) ? "Given" : "Not on file"}</Pill>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>
        </div>
      )}

      {tab === "conversations" && (
        <Panel
          title="Conversations"
          hint={`Every thread with ${contact.firstName ?? "this client"}, newest first`}
          right={
            <Tabs
              className="border-b-0"
              label="Show"
              value={show}
              options={[
                { key: "all", label: "All", href: tabHref("conversations") },
                { key: "open", label: "Open", href: `${tabHref("conversations")}&show=open` },
                { key: "closed", label: "Closed", href: `${tabHref("conversations")}&show=closed` },
              ]}
            />
          }
          flush
          footer={d.capped ? `Showing the newest ${CLIENT_CONVERSATIONS_CAP} conversations.` : undefined}
        >
          <Threads convs={convs.filter((c) => show === "all" || (show === "open") === ["new", "active"].includes(c.status))} tz={tz} detailed />
        </Panel>
      )}

      {tab === "calls" && (
        <Panel title="Calls" hint="Recording and transcript play for admins only">
          {d.calls.length === 0 ? (
            <p className="text-sm text-ink-muted">No calls yet.</p>
          ) : (
            <ul className="flex flex-col gap-4">
              {d.calls.map((c) => (
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
                    hasRecording: c.hasRecording,
                    messageTaken: false,
                  }}
                />
              ))}
            </ul>
          )}
        </Panel>
      )}

      {tab === "meetings" && (
        <Panel
          title="Meetings"
          hint={`${d.meetings.length} ${d.meetings.length === 1 ? "meeting" : "meetings"}`}
          flush
          footer={
            <>
              <span>Outcome is recorded by your reps after the meeting.</span>
              <Link href="/meetings" className="ml-auto">
                All meetings
              </Link>
            </>
          }
        >
          <MeetingsTable meetings={d.meetings} tz={tz} name={clientName} canAct={canAct} />
        </Panel>
      )}

      {tab === "psa" && d.psa.length > 0 && (
        <div className="flex flex-col gap-3.5">
          <Panel title="ConnectWise" hint="What Alevo wrote for this client">
            <div className="flex flex-wrap items-center gap-2">
              <Pill tone="success">Synced</Pill>
              <span className="text-ink-muted">Last write {fmtShort(d.psa.at(-1)!.createdAt, tz)}</span>
            </div>
            <p className="mt-1.5 max-w-xl text-[13px] leading-[19px] text-ink-muted">
              PSA is the professional services automation tool your team already runs, here ConnectWise. Alevo writes each lead into it, so your team never re-types a lead.
            </p>
          </Panel>
          <Panel title="Records" flush>
            <Table>
              <thead>
                <tr>
                  <Th>Record</Th>
                  <Th>ID</Th>
                  <Th>Written</Th>
                </tr>
              </thead>
              <tbody>
                {d.psa.map((r) => (
                  <Tr key={`${r.kind}-${r.remoteId}`}>
                    <Td>{PSA_KIND[r.kind] ?? r.kind}</Td>
                    <Td className="font-mono text-ink-muted">{r.remoteId}</Td>
                    <Td className="tabular font-mono text-[12px] text-ink-muted">{fmtShort(r.createdAt, tz)}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </Panel>
        </div>
      )}
    </div>
  );
}

/** Threads as rows: channel mark, title, meta, status pill and fit meter. `detailed` adds the last line. */
function Threads({ convs, tz, detailed = false }: { convs: ClientConversation[]; tz: string; detailed?: boolean }) {
  if (convs.length === 0) return <p className="px-3.5 py-6 text-center text-sm text-ink-muted">No conversations yet.</p>;
  return (
    <ul>
      {convs.map((c) => {
        const status = CONVERSATION_STATUS[c.status];
        const Icon = CHANNEL_ICON[c.channel];
        const outcome = c.callOutcome ? CALL_OUTCOME[c.callOutcome as CallOutcome] : null;
        return (
          <li key={c.id} className="grid grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-3.5 border-t border-hairline/60 px-4 py-3 first:border-t-0">
            <span aria-hidden="true" className="grid size-9 place-items-center rounded-xs border border-hairline bg-sunken text-ink-muted">
              <Icon className="size-4" strokeWidth={1.75} />
            </span>
            <div className="min-w-0">
              <Link href={`/conversations/${c.id}`} transitionTypes={["nav-forward"]} className="text-[15px] font-semibold text-ink no-underline hover:underline">
                {CHANNEL_LABEL[c.channel]} conversation
              </Link>
              <div className="mt-0.5 text-[13px] leading-[19px] text-ink-muted">
                {CHANNEL_LABEL[c.channel]}
                {c.channel === "voice" && c.callDurationSec != null ? ` · ${fmtDuration(c.callDurationSec)}` : ""}
                {outcome ? ` · ${outcome.label}` : ""} · started {fmtShort(c.createdAt, tz)} · last entry {fmtShort(c.lastEntryAt, tz)}
              </div>
              {detailed && c.lastPreview && <div className="mt-1.5 line-clamp-2 text-sm text-ink">{c.lastPreview}</div>}
            </div>
            <div className="flex items-center gap-4">
              <Pill tone={status.tone}>{status.label}</Pill>
              <span className="flex w-[92px] justify-end">
                <FitMeter score={c.fitScore} />
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function CallRow({ call, tz }: { call: ClientDetail["calls"][number]; tz: string }) {
  const outcome = CALL_OUTCOME[(call.outcome ?? "none") as CallOutcome] ?? CALL_OUTCOME.none;
  return (
    <li className="grid grid-cols-[36px_minmax(0,1fr)] items-start gap-3.5 border-t border-hairline/60 px-4 py-3 first:border-t-0">
      <span aria-hidden="true" className="grid size-9 place-items-center rounded-xs border border-hairline bg-sunken text-ink-muted">
        <Phone className="size-4" strokeWidth={1.75} />
      </span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="font-mono text-sm font-semibold">{fmtShort(call.startedAt, tz)}</span>
          <span className="font-mono text-ink-muted">{fmtDuration(call.durationSec)}</span>
          <Pill tone={outcome.tone}>{outcome.label}</Pill>
        </div>
        {call.summary && <p className="mt-0.5 text-sm text-ink-muted">{call.summary}</p>}
      </div>
    </li>
  );
}

/** Reps and above record the outcome and reschedule / cancel here (the Meetings page's controls); others read it. */
function MeetingsTable({ meetings, tz, name, canAct, compact = false }: { meetings: ClientDetail["meetings"]; tz: string; name: string; canAct: boolean; compact?: boolean }) {
  return (
    <Table>
      <thead>
        <tr>
          <Th>When</Th>
          <Th>Source</Th>
          <Th>Status</Th>
          <Th>Outcome</Th>
          {canAct && !compact && <Th className="text-right">Manage</Th>}
        </tr>
      </thead>
      <tbody>
        {meetings.length === 0 ? (
          <EmptyRow colSpan={canAct && !compact ? 5 : 4}>No meetings yet.</EmptyRow>
        ) : (
          (compact ? meetings.slice(0, 3) : meetings).map((m) => {
            const status = MEETING_STATUS[m.status];
            return (
              <Tr key={m.id}>
                <Td className="font-mono text-[12px]">{m.startAt ? fmtDateTime(m.startAt, tz) : "Time to be set"}</Td>
                <Td>{PROVIDER_LABEL[m.provider]}</Td>
                <Td>
                  <Pill tone={status.tone}>{status.label}</Pill>
                </Td>
                <Td className="text-ink-muted">
                  {canAct && !compact ? <OutcomeControls id={m.id} status={m.status} outcome={m.outcome} converted={m.converted} /> : MEETING_OUTCOME[m.outcome]}
                </Td>
                {canAct && !compact && (
                  <Td className="text-right">
                    <ManageControls id={m.id} provider={m.provider} status={m.status} contact={name} />
                  </Td>
                )}
              </Tr>
            );
          })
        )}
      </tbody>
    </Table>
  );
}

function PsaList({ psa, tz }: { psa: ClientDetail["psa"]; tz: string }) {
  return (
    <dl className="flex flex-col gap-2">
      {psa.map((r) => (
        <div key={`${r.kind}-${r.remoteId}`} className="flex justify-between gap-3">
          <dt className="text-ink-muted">{PSA_KIND[r.kind] ?? r.kind}</dt>
          <dd className="font-mono">
            #{r.remoteId} <span className="text-[13px] text-ink-muted">{fmtShort(r.createdAt, tz)}</span>
          </dd>
        </div>
      ))}
    </dl>
  );
}
