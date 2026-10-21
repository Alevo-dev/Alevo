"use client";

import { useActionState, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Search, Trash2 } from "lucide-react";
import { cx } from "@/lib/cx";
import { initials } from "@/lib/format";
import { ROLE_LABEL } from "@/lib/ui/status";
import { toast } from "@/lib/ui/use-action-toast";
import { loadMembers, type InviteView, type MemberView } from "@/app/(app)/workspace/org-actions";
import {
  changeMemberRole,
  inviteMember,
  removeMember,
  revokeInvite,
  type ActionState,
} from "@/app/(app)/workspace/members/actions";
import { Button, Spinner } from "@/components/ui/button";
import { ConfirmSubmit } from "@/components/ui/confirm-dialog";
import { Field, Input } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { Pill } from "@/components/ui/pill";
import { Select } from "@/components/ui/select";

const ROLES = ["viewer", "rep", "admin", "owner"] as const;
const ROLE_OPTIONS = ROLES.map((r) => ({ value: r, label: ROLE_LABEL[r] }));
const INITIAL: ActionState = {};
const AVATAR_FILLS = ["bg-brand", "bg-violet", "bg-brand-sky", "bg-violet-light"];

/** Toast + run `onOk` once per successful dispatch; toast any error. */
function useActionResult(state: ActionState, message: string, onOk: () => void) {
  const last = useRef<ActionState | null>(null);
  useEffect(() => {
    if (last.current === state) return;
    if (state.ok) {
      last.current = state;
      toast.success(message);
      onOk();
    } else if (state.error) {
      last.current = state;
      toast.error(state.error);
    }
  }, [state, message, onOk]);
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString();
}

/** Right pane of the dialog — same container as the account panes. */
function Wrap({ children }: { children: ReactNode }) {
  return <div className="min-w-0 flex-1 overflow-y-auto p-6 md:p-8 md:pt-6">{children}</div>;
}

export function MembersTab() {
  const [data, setData] = useState<Awaited<ReturnType<typeof loadMembers>> | null>(null);
  const [tab, setTab] = useState<"members" | "invites">("members");
  const [query, setQuery] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);

  const reload = useCallback(async () => {
    setData(await loadMembers());
  }, []);
  // Initial load: set state from the resolved promise (not synchronously in the
  // effect), and ignore a late result if the dialog unmounts first.
  useEffect(() => {
    let active = true;
    void loadMembers().then((r) => {
      if (active) setData(r);
    });
    return () => {
      active = false;
    };
  }, []);

  if (!data) {
    return (
      <Wrap>
        <div className="flex items-center gap-2 py-8 text-sm text-ink-muted">
          <Spinner /> Loading members…
        </div>
      </Wrap>
    );
  }
  if ("error" in data) {
    return (
      <Wrap>
        <Notice tone="warning">You need an admin role to manage members.</Notice>
      </Wrap>
    );
  }

  const { members, pending } = data;
  const q = query.trim().toLowerCase();
  const filtered = q
    ? members.filter(
        (m) => (m.name ?? "").toLowerCase().includes(q) || (m.email ?? "").toLowerCase().includes(q),
      )
    : members;

  return (
    <Wrap>
      <div role="tablist" aria-label="Members and invitations" className="flex gap-6 border-b border-hairline">
        <SubTab active={tab === "members"} onClick={() => setTab("members")} label="Members" count={members.length} />
        <SubTab active={tab === "invites"} onClick={() => setTab("invites")} label="Invitations" count={pending.length} />
      </div>

      <div className="mt-5 flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" strokeWidth={1.75} aria-hidden="true" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
            aria-label="Search members"
            className="pl-9"
          />
        </div>
        <Button variant="primary" onClick={() => setInviteOpen((o) => !o)}>
          Invite
        </Button>
      </div>

      {inviteOpen && (
        <InviteForm
          onDone={() => {
            setInviteOpen(false);
            void reload();
          }}
        />
      )}

      {tab === "members" ? (
        <ul className="mt-4 divide-y divide-hairline">
          {filtered.length === 0 && <li className="py-6 text-sm text-ink-muted">No members found.</li>}
          {filtered.map((m) => (
            <MemberRow key={m.userId} member={m} reload={reload} />
          ))}
        </ul>
      ) : (
        <ul className="mt-4 divide-y divide-hairline">
          {pending.length === 0 && <li className="py-6 text-sm text-ink-muted">No pending invitations.</li>}
          {pending.map((inv) => (
            <InviteRow key={inv.id} invite={inv} reload={reload} />
          ))}
        </ul>
      )}
    </Wrap>
  );
}

function SubTab({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cx(
        "relative flex items-center gap-2 py-3 text-sm transition-colors",
        "after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:rounded-full",
        active ? "font-semibold text-ink after:bg-brand" : "font-medium text-ink-muted hover:text-ink",
      )}
    >
      {label}
      <span className="rounded-full bg-raised px-1.5 text-label text-ink-muted">{count}</span>
    </button>
  );
}

function MemberRow({ member, reload }: { member: MemberView; reload: () => void }) {
  const [roleState, roleAction, rolePending] = useActionState(changeMemberRole, INITIAL);
  const [rmState, rmAction, rmPending] = useActionState(removeMember, INITIAL);
  const [dirty, setDirty] = useState(false);
  useActionResult(roleState, "Role updated.", () => {
    setDirty(false);
    reload();
  });
  useActionResult(rmState, "Member removed.", reload);

  return (
    <li className="flex items-center gap-3 py-3">
      <Avatar name={member.name} seed={member.email ?? member.userId} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-ink">{member.name ?? member.email ?? "—"}</div>
        {member.name && member.email && <div className="truncate text-label text-ink-muted">{member.email}</div>}
      </div>
      <div className="hidden w-24 shrink-0 text-label text-ink-muted sm:block">{fmtDate(member.joinedAt)}</div>
      <form action={roleAction} onSubmit={() => setDirty(false)} className="flex shrink-0 items-center gap-1.5">
        <input type="hidden" name="userId" value={member.userId} />
        <input type="hidden" name="clerkUserId" value={member.clerkUserId} />
        {/* Fixed width so the trigger doesn't resize with the selected role. */}
        <div className="w-28">
          <Select
            name="role"
            size="sm"
            options={ROLE_OPTIONS}
            defaultValue={member.role}
            onChange={() => setDirty(true)}
            aria-label={`Role for ${member.email ?? member.userId}`}
          />
        </div>
        {dirty && (
          <Button type="submit" size="sm" variant="ghost" loading={rolePending}>
            Save
          </Button>
        )}
      </form>
      <form action={rmAction} className="shrink-0">
        <input type="hidden" name="userId" value={member.userId} />
        <input type="hidden" name="clerkUserId" value={member.clerkUserId} />
        <ConfirmSubmit
          icon={Trash2}
          aria-label={`Remove ${member.name ?? member.email ?? "member"}`}
          loading={rmPending}
          title={`Remove ${member.name ?? member.email ?? "this member"}?`}
          description="They lose access to this workspace right away. Their past activity stays on the record."
          confirmLabel="Remove member"
        />
      </form>
    </li>
  );
}

function InviteRow({ invite, reload }: { invite: InviteView; reload: () => void }) {
  const [state, action, pending] = useActionState(revokeInvite, INITIAL);
  useActionResult(state, "Invite revoked.", reload);

  return (
    <li className="flex items-center gap-3 py-3">
      <Avatar name={null} seed={invite.email} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-ink">{invite.email}</div>
        <div className="truncate text-label text-warning">Invite pending</div>
      </div>
      <Pill tone="brand">{ROLE_LABEL[invite.role]}</Pill>
      <form action={action} className="shrink-0">
        <input type="hidden" name="clerkInvitationId" value={invite.clerkInvitationId ?? ""} />
        <ConfirmSubmit
          icon={Trash2}
          aria-label={`Revoke invite for ${invite.email}`}
          loading={pending}
          disabled={!invite.clerkInvitationId}
          title={`Revoke the invite for ${invite.email}?`}
          description="The link in their email stops working. You can send a new invite any time."
          confirmLabel="Revoke invite"
        />
      </form>
    </li>
  );
}

function InviteForm({ onDone }: { onDone: () => void }) {
  const [state, action, pending] = useActionState(inviteMember, INITIAL);
  const [dirty, setDirty] = useState(false);
  useActionResult(state, "Invitation sent.", onDone);
  const emailError = dirty ? undefined : state.errors?.email;

  return (
    <form
      action={action}
      onSubmit={() => setDirty(false)}
      noValidate
      className="mt-4 flex flex-wrap items-end gap-3 rounded-lg border border-hairline bg-surface p-4"
    >
      <Field label="Email" htmlFor="inv-email" error={emailError} className="min-w-56 flex-1">
        <Input
          id="inv-email"
          name="email"
          type="email"
          defaultValue={state.values?.email}
          onChange={() => setDirty(true)}
          invalid={!!emailError}
          placeholder="name@company.com"
        />
      </Field>
      <Field label="Role" htmlFor="inv-role" className="w-36">
        <Select id="inv-role" name="role" options={ROLE_OPTIONS} defaultValue={state.values?.role ?? "rep"} />
      </Field>
      <Button type="submit" variant="primary" loading={pending} className="mb-px">
        {pending ? "Sending…" : "Send invite"}
      </Button>
    </form>
  );
}

/** 32px initials disc; fill picked deterministically from the key. */
function Avatar({ name, seed }: { name: string | null; seed: string }) {
  let hash = 0;
  for (const ch of seed) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return (
    <span
      aria-hidden="true"
      className={cx(
        "inline-flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-on-brand",
        AVATAR_FILLS[hash % AVATAR_FILLS.length],
      )}
    >
      {initials(name ?? seed)}
    </span>
  );
}
