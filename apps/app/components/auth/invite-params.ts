import type { Invite, InviteStatus } from "./invite-join";

/** Query params Clerk appends when redirecting an invitee to our sign-up URL. */
export type InviteSearchParams = { __clerk_ticket?: string | string[]; __clerk_status?: string | string[] };

const STATUSES: readonly InviteStatus[] = ["sign_up", "sign_in", "complete"];

export function inviteFromSearchParams(sp: InviteSearchParams): Invite | undefined {
  const ticket = Array.isArray(sp.__clerk_ticket) ? sp.__clerk_ticket[0] : sp.__clerk_ticket;
  const status = Array.isArray(sp.__clerk_status) ? sp.__clerk_status[0] : sp.__clerk_status;
  if (!ticket || !status || !(STATUSES as readonly string[]).includes(status)) return undefined;
  return { ticket, status: status as InviteStatus };
}
