"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmSubmit } from "@/components/ui/confirm-dialog";
import { Field, FieldError, Input } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { Pill } from "@/components/ui/pill";
import { Td, Tr } from "@/components/ui/table";
import { cx } from "@/lib/cx";
import { initials } from "@/lib/format";
import { ROLE_LABEL } from "@/lib/ui/status";
import { useActionToast } from "@/lib/ui/use-action-toast";
import { changeMemberRole, inviteMember, removeMember, revokeInvite, type ActionState } from "./actions";

const ROLES = ["viewer", "rep", "admin", "owner"] as const;
type Role = (typeof ROLES)[number];

export type MemberView = {
  userId: string;
  clerkUserId: string;
  email: string | null;
  name: string | null;
  role: Role;
};

export type InviteView = {
  id: string;
  email: string;
  role: Role;
  clerkInvitationId: string | null;
};

const INITIAL: ActionState = {};
const ROLE_OPTIONS = ROLES.map((r) => ({ value: r, label: ROLE_LABEL[r] }));

const AVATAR_FILLS = ["bg-brand", "bg-violet", "bg-brand-sky", "bg-violet-light"];

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

function Identity({ name, email, seed, note }: { name: string | null; email: string | null; seed: string; note?: string }) {
  return (
    <span className="flex items-center gap-3">
      <Avatar name={name} seed={seed} />
      <span className="min-w-0">
        <span className="block truncate font-semibold text-ink">{name ?? email ?? "—"}</span>
        <span className={cx("block truncate text-label", note ? "text-warning" : "text-ink-muted")}>
          {note ?? (name ? email : "")}
        </span>
      </span>
    </span>
  );
}

export function InviteForm() {
  const [state, action, pending] = useActionState(inviteMember, INITIAL);
  const [dirty, setDirty] = useState(false);
  useActionToast(state, "Invitation sent.");
  const emailError = dirty ? undefined : state.errors?.email;
  const formError = dirty ? undefined : state.error;

  return (
    <form action={action} onSubmit={() => setDirty(false)} noValidate className="flex flex-wrap items-end gap-3">
      <Field label="Email" htmlFor="invite-email" error={emailError} className="min-w-64 flex-1">
        <Input
          id="invite-email"
          name="email"
          type="email"
          defaultValue={state.values?.email}
          onChange={() => setDirty(true)}
          invalid={!!emailError}
          placeholder="name@company.com"
        />
      </Field>
      <Field label="Role" htmlFor="invite-role" className="w-40">
        <Select
          id="invite-role"
          name="role"
          options={ROLE_OPTIONS}
          defaultValue={state.values?.role ?? "rep"}
          onChange={() => setDirty(true)}
        />
      </Field>
      <Button type="submit" variant="primary" loading={pending} className="mb-[1px]">
        {pending ? "Sending…" : "Send invite"}
      </Button>
      {formError && <p className="w-full text-sm text-danger">{formError}</p>}
    </form>
  );
}

export function MemberRow({ member }: { member: MemberView }) {
  const [roleState, roleAction, rolePending] = useActionState(changeMemberRole, INITIAL);
  const [rmState, rmAction, rmPending] = useActionState(removeMember, INITIAL);
  const [dirty, setDirty] = useState(false);
  useActionToast(roleState, "Role updated.");
  useActionToast(rmState, "Member removed.");
  const error = dirty ? undefined : (roleState.error ?? rmState.error);

  return (
    <Tr>
      <Td>
        <Identity name={member.name} email={member.email} seed={member.email ?? member.userId} />
      </Td>
      <Td>
        <form action={roleAction} onSubmit={() => setDirty(false)} noValidate className="flex items-center gap-2">
          <input type="hidden" name="userId" value={member.userId} />
          <input type="hidden" name="clerkUserId" value={member.clerkUserId} />
          <Select
            name="role"
            inline
            size="sm"
            options={ROLE_OPTIONS}
            defaultValue={member.role}
            onChange={() => setDirty(true)}
            aria-label={`Role for ${member.email ?? member.userId}`}
          />
          <Button type="submit" size="sm" variant="ghost" loading={rolePending}>
            Save
          </Button>
        </form>
        <FieldError>{error}</FieldError>
      </Td>
      <Td className="text-right">
        <form action={rmAction} onSubmit={() => setDirty(false)}>
          <input type="hidden" name="userId" value={member.userId} />
          <input type="hidden" name="clerkUserId" value={member.clerkUserId} />
          <ConfirmSubmit
            size="sm"
            loading={rmPending}
            title={`Remove ${member.name ?? member.email ?? "this member"}?`}
            description="They lose access to this workspace right away. Their past activity stays on the record."
            confirmLabel="Remove member"
          >
            Remove
          </ConfirmSubmit>
        </form>
      </Td>
    </Tr>
  );
}

export function PendingInviteRow({ invite }: { invite: InviteView }) {
  const [state, action, pending] = useActionState(revokeInvite, INITIAL);
  useActionToast(state, "Invite revoked.");
  return (
    <Tr>
      <Td>
        <Identity name={null} email={invite.email} seed={invite.email} note="Invite pending" />
      </Td>
      <Td>
        <Pill tone="brand">{ROLE_LABEL[invite.role]}</Pill>
        <FieldError>{state.error}</FieldError>
      </Td>
      <Td className="text-right">
        <form action={action}>
          <input type="hidden" name="clerkInvitationId" value={invite.clerkInvitationId ?? ""} />
          <ConfirmSubmit
            size="sm"
            loading={pending} disabled={!invite.clerkInvitationId}
            title={`Revoke the invite for ${invite.email}?`}
            description="The link in their email stops working. You can send a new invite any time."
            confirmLabel="Revoke invite"
          >
            Revoke
          </ConfirmSubmit>
        </form>
      </Td>
    </Tr>
  );
}
