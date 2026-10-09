"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  changeMemberRole,
  inviteMember,
  removeMember,
  revokeInvite,
  type ActionState,
} from "./actions";

/** Re-fetch the server-rendered list after a successful mutation so the UI
 *  reflects the change immediately (no manual reload). `state` is a fresh object
 *  per dispatch, so this fires on every success. */
function useRefreshOnSuccess(state: ActionState) {
  const router = useRouter();
  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state, router]);
}

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
const selectClass =
  "rounded-md border border-input bg-background px-2 py-1 text-sm";
const btnClass =
  "rounded-md border border-border px-3 py-1 text-sm hover:bg-accent disabled:opacity-50";

function RoleOptions() {
  return (
    <>
      {ROLES.map((r) => (
        <option key={r} value={r}>
          {r}
        </option>
      ))}
    </>
  );
}

export function InviteForm() {
  const [state, action, pending] = useActionState(inviteMember, INITIAL);
  useRefreshOnSuccess(state);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input
        name="email"
        type="email"
        required
        placeholder="teammate@company.com"
        className="min-w-64 flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm"
      />
      <select name="role" defaultValue="rep" className={selectClass} aria-label="Role">
        <RoleOptions />
      </select>
      <button type="submit" disabled={pending} className={btnClass}>
        {pending ? "Inviting…" : "Invite"}
      </button>
      {state.error && <p className="w-full text-sm text-destructive">{state.error}</p>}
      {state.ok && <p className="w-full text-sm text-muted-foreground">Invitation sent.</p>}
    </form>
  );
}

export function MemberRow({ member }: { member: MemberView }) {
  const [roleState, roleAction, rolePending] = useActionState(changeMemberRole, INITIAL);
  const [rmState, rmAction, rmPending] = useActionState(removeMember, INITIAL);
  useRefreshOnSuccess(roleState);
  useRefreshOnSuccess(rmState);
  const error = roleState.error ?? rmState.error;

  return (
    <>
      <tr className="border-b border-border">
        <td className="py-2 pr-4">{member.name ?? "—"}</td>
        <td className="py-2 pr-4 text-muted-foreground">{member.email ?? "—"}</td>
        <td className="py-2 pr-4">
          <form action={roleAction} className="flex items-center gap-2">
            <input type="hidden" name="userId" value={member.userId} />
            <input type="hidden" name="clerkUserId" value={member.clerkUserId} />
            <select
              name="role"
              defaultValue={member.role}
              className={selectClass}
              aria-label={`Role for ${member.email ?? member.userId}`}
            >
              <RoleOptions />
            </select>
            <button type="submit" disabled={rolePending} className={btnClass}>
              Save
            </button>
          </form>
        </td>
        <td className="py-2">
          <form action={rmAction}>
            <input type="hidden" name="userId" value={member.userId} />
            <input type="hidden" name="clerkUserId" value={member.clerkUserId} />
            <button type="submit" disabled={rmPending} className={btnClass}>
              Remove
            </button>
          </form>
        </td>
      </tr>
      {error && (
        <tr>
          <td colSpan={4} className="pb-2 text-sm text-destructive">
            {error}
          </td>
        </tr>
      )}
    </>
  );
}

export function PendingInviteRow({ invite }: { invite: InviteView }) {
  const [state, action, pending] = useActionState(revokeInvite, INITIAL);
  useRefreshOnSuccess(state);
  return (
    <>
      <tr className="border-b border-border">
        <td className="py-2 pr-4">{invite.email}</td>
        <td className="py-2 pr-4 text-muted-foreground">{invite.role}</td>
        <td className="py-2">
          <form action={action}>
            <input
              type="hidden"
              name="clerkInvitationId"
              value={invite.clerkInvitationId ?? ""}
            />
            <button
              type="submit"
              disabled={pending || !invite.clerkInvitationId}
              className={btnClass}
            >
              Revoke
            </button>
          </form>
        </td>
      </tr>
      {state.error && (
        <tr>
          <td colSpan={3} className="pb-2 text-sm text-destructive">
            {state.error}
          </td>
        </tr>
      )}
    </>
  );
}
