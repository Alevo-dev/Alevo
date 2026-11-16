"use client";

import { useActionState, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, Trash2 } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader } from "@/components/ui/card";
import { ConfirmSubmit } from "@/components/ui/confirm-dialog";
import { Field, Input } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { Pill } from "@/components/ui/pill";
import { Tabs } from "@/components/ui/nav-kit";
import { EmptyRow, Table, Td, Th, Tr } from "@/components/ui/table";
import { Select } from "@/components/ui/select";
import { LeaveDialog, useLeaveGuard } from "@/components/ui/unsaved-changes";
import { SaveBar } from "@/components/workspace/save-bar";

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

/** The panel the Members list sits in on the Manage page. */
function Wrap({ children }: { children: ReactNode }) {
  return (
    <Card padding="none">
      <CardHeader title="Members" hint="Everyone sees this list. Only owners and admins can change it." />
      {children}
    </Card>
  );
}

/** Everyone sees the list; only admins and owners invite, change roles or remove people (the server actions enforce it too). */
export function MembersTab({ canEdit }: { canEdit: boolean }) {
  const [data, setData] = useState<Awaited<ReturnType<typeof loadMembers>> | null>(null);
  const [tab, setTab] = useState<"members" | "invites">("members");
  const [query, setQuery] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);

  const reload = useCallback(async () => {
    setData(await loadMembers());
  }, []);

  // Role changes are picked in the list and saved together from the bottom bar (never inline).
  const router = useRouter();
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const changed = data && !("error" in data) ? data.members.filter((m) => edits[m.userId] && edits[m.userId] !== m.role) : [];
  const dirty = changed.length > 0;
  const guard = useLeaveGuard(dirty);

  /** True once every change is saved; on a refusal it stops there, keeps the rest unsaved and says why. */
  async function save(): Promise<boolean> {
    setSaving(true);
    setSaveError(null);
    for (const m of changed) {
      const fd = new FormData();
      fd.set("userId", m.userId);
      fd.set("clerkUserId", m.clerkUserId);
      fd.set("role", edits[m.userId]!);
      const r = await changeMemberRole(INITIAL, fd);
      if (!r.ok) {
        setSaveError(`${m.name ?? m.email ?? "A member"}: ${r.error ?? "The role could not be changed."}`);
        setSaving(false);
        await reload();
        return false;
      }
    }
    toast.success(changed.length === 1 ? "Role updated." : "Roles updated.");
    setEdits({});
    await reload();
    setSaving(false);
    return true;
  }

  async function saveAndLeave() {
    const href = guard.pendingHref;
    guard.stay();
    if ((await save()) && href) router.push(href);
  }
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
        <div aria-busy="true" aria-live="polite">
          <span className="sr-only">Loading members…</span>
          <div className="flex flex-wrap items-center gap-2 border-b border-hairline py-2.5">
            <Skeleton className="h-8 w-44 rounded-xs" />
            <Skeleton className="h-8 w-[220px] max-w-full rounded-xs" delay={60} />
            <Skeleton className="ml-auto h-8 w-24 rounded-xs" delay={120} />
          </div>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-2.5 border-b border-hairline/60 py-3 last:border-b-0">
              <Skeleton className="size-8 shrink-0 rounded-full" delay={160 + i * 70} />
              <div className="space-y-1.5">
                <Skeleton className="h-3.5 w-36 rounded-xs" delay={180 + i * 70} />
                <Skeleton className="h-3 w-48 rounded-xs" delay={200 + i * 70} />
              </div>
              <Skeleton className="ml-auto h-5 w-16 rounded-full" delay={220 + i * 70} />
            </div>
          ))}
        </div>
      </Wrap>
    );
  }
  if ("error" in data) {
    return (
      <Wrap>
        <div className="p-3.5">
          <Notice tone="warning">Could not load the members. Try again in a moment.</Notice>
        </div>
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
  const showMembers = tab === "members" || !canEdit;

  return (
    <Wrap>
      {/* Toolbar: Members / Invitations switch, search, Invite. */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-hairline py-2.5">
        {canEdit && (
          <Tabs
            className="border-b-0"
            label="Members and invitations"
            value={tab}
            options={[
              { key: "members", label: "Members", count: members.length, onSelect: () => setTab("members") },
              { key: "invites", label: "Invitations", count: pending.length, onSelect: () => setTab("invites") },
            ]}
          />
        )}
        <div className="relative w-[220px] max-w-full">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-muted" strokeWidth={2} aria-hidden="true" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search members"
            aria-label="Search members"
            className="pl-8"
          />
        </div>
        {canEdit && (
          <Button variant="primary" className="ml-auto" aria-expanded={inviteOpen} onClick={() => setInviteOpen((o) => !o)}>
            <Plus className="size-3.5" strokeWidth={2} aria-hidden="true" />
            Invite
          </Button>
        )}
      </div>

      {canEdit && inviteOpen && (
        <InviteForm
          onDone={() => {
            setInviteOpen(false);
            void reload();
          }}
        />
      )}

      {showMembers ? (
        <Table>
          <thead>
            <tr>
              <Th>Member</Th>
              <Th>Role</Th>
              <Th>
                <span className="sr-only">Actions</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && <EmptyRow colSpan={3}>No members found.</EmptyRow>}
            {filtered.map((m) => (
              <MemberRow
                key={m.userId}
                member={m}
                role={edits[m.userId] ?? m.role}
                onRole={(r) => setEdits((e) => ({ ...e, [m.userId]: r }))}
                reload={reload}
                canEdit={canEdit}
              />
            ))}
          </tbody>
        </Table>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Invitation</Th>
              <Th>Role</Th>
              <Th>
                <span className="sr-only">Actions</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {pending.length === 0 && <EmptyRow colSpan={3}>No pending invitations.</EmptyRow>}
            {pending.map((inv) => (
              <InviteRow key={inv.id} invite={inv} reload={reload} />
            ))}
          </tbody>
        </Table>
      )}

      {/* Only the bar sits in this form: the rows hold their own forms (remove, revoke), which cannot nest. */}
      {canEdit && (
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <SaveBar visible={dirty} pending={saving} error={saveError} onDiscard={() => { setEdits({}); setSaveError(null); }} />
          <LeaveDialog open={guard.pendingHref !== null} what="the role changes" onStay={guard.stay} onLeave={guard.leave} onSave={saveAndLeave} />
        </form>
      )}
    </Wrap>
  );
}

function MemberRow({
  member,
  role,
  onRole,
  reload,
  canEdit,
}: {
  member: MemberView;
  /** The role shown: the saved one, or the one picked and not saved yet. */
  role: string;
  onRole: (role: string) => void;
  reload: () => void;
  canEdit: boolean;
}) {
  const [rmState, rmAction, rmPending] = useActionState(removeMember, INITIAL);
  useActionResult(rmState, "Member removed.", reload);

  return (
    <Tr>
      <Td>
        <span className="flex items-center gap-2.5">
          <Avatar name={member.name} seed={member.email ?? member.userId} />
          <span className="min-w-0">
            <span className="block truncate font-semibold text-ink">{member.name ?? member.email ?? "—"}</span>
            {member.name && member.email && <span className="block truncate text-[12.5px] text-ink-muted">{member.email}</span>}
          </span>
        </span>
      </Td>
      <Td>
        {member.support ? (
          <Pill tone="muted">Alevo support</Pill>
        ) : !canEdit ? (
          <Pill tone="brand">{ROLE_LABEL[member.role]}</Pill>
        ) : (
          /* Fixed width so the trigger doesn't resize with the selected role. */
          <div className="w-[110px]">
            <Select options={ROLE_OPTIONS} value={role} onChange={onRole} aria-label={`Role for ${member.email ?? member.userId}`} />
          </div>
        )}
      </Td>
      <Td className="text-right">
        {canEdit && !member.support && (
          <form action={rmAction} className="inline-block">
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
        )}
      </Td>
    </Tr>
  );
}

function InviteRow({ invite, reload }: { invite: InviteView; reload: () => void }) {
  const [state, action, pending] = useActionState(revokeInvite, INITIAL);
  useActionResult(state, "Invite revoked.", reload);

  return (
    <Tr>
      <Td>
        <span className="flex items-center gap-2.5">
          <Avatar name={null} seed={invite.email} />
          <span className="min-w-0">
            <span className="block truncate font-semibold text-ink">{invite.email}</span>
            <span className="block truncate text-[12.5px] text-warning">Invite pending</span>
          </span>
        </span>
      </Td>
      <Td>
        <Pill tone="brand">{ROLE_LABEL[invite.role]}</Pill>
      </Td>
      <Td className="text-right">
        <form action={action} className="inline-block">
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
      </Td>
    </Tr>
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
      className="flex flex-wrap items-end gap-3 border-b border-hairline bg-canvas px-3.5 py-3"
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

/** 30px initials disc; fill picked deterministically from the key. */
function Avatar({ name, seed }: { name: string | null; seed: string }) {
  let hash = 0;
  for (const ch of seed) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return (
    <span
      aria-hidden="true"
      className={cx(
        "inline-flex size-[30px] shrink-0 items-center justify-center rounded-full text-[12px] font-bold text-on-brand",
        AVATAR_FILLS[hash % AVATAR_FILLS.length],
      )}
    >
      {initials(name ?? seed)}
    </span>
  );
}
