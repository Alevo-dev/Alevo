"use client";

import { useActionState } from "react";
import { Button, buttonClass } from "@/components/ui/button";
import { ConfirmSubmit } from "@/components/ui/confirm-dialog";
import { Notice } from "@/components/ui/notice";
import { BOOKING_TOOL_LABEL } from "@/lib/booking/connected";
import { useActionToast } from "@/lib/ui/use-action-toast";
import {
  disconnectCalendar,
  testCalendar,
  type ActionState,
  type CalendarTestState,
} from "./actions";

const INITIAL: ActionState = {};
const START: Record<"google" | "m365", string> = {
  google: "/api/oauth/google/start",
  m365: "/api/oauth/microsoft/start",
};

type Props = {
  provider: "google" | "m365";
  /** The calendar currently connected for this org (one at a time), if any. */
  connected: { provider: "google" | "m365"; email: string | null } | null;
  canModify: boolean;
};

/**
 * Connect / Disconnect for a direct booking calendar. Connect is a plain link
 * into the OAuth start route (an admin-only redirect); Disconnect is a
 * confirmed server action; Test connection makes the agent's free/busy call so
 * a disabled API or revoked grant shows up here, not in a lead's thread. Alevo
 * books on one calendar at a time.
 */
export function CalendarConnect({ provider, connected, canModify }: Props) {
  const [state, action, pending] = useActionState(disconnectCalendar, INITIAL);
  useActionToast(state, "Calendar disconnected.");
  const [test, testAction, testing] = useActionState<
    CalendarTestState,
    FormData
  >(testCalendar, {});
  const label = BOOKING_TOOL_LABEL[provider];

  if (connected && connected.provider !== provider) {
    return (
      <p className="rounded-md border border-hairline p-4 text-sm text-ink-muted">
        {BOOKING_TOOL_LABEL[connected.provider]} is connected. Alevo books on
        one calendar at a time, so disconnect it first to connect {label}.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <form
        action={action}
        className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-hairline p-4"
      >
        {connected ? (
          <>
            <p className="text-sm">
              <span className="font-semibold text-ink">Connected</span>
              {connected.email && (
                <span className="text-ink-muted">, {connected.email}</span>
              )}
              <span className="block text-label text-ink-muted">
                The agent reads free/busy and creates events with a video link.
              </span>
            </p>
            {canModify && (
              <ConfirmSubmit
                loading={pending}
                title="Disconnect this calendar?"
                description="The agent stops booking on it and hands qualified leads to a person until another tool is chosen. Existing meetings are not touched."
                confirmLabel="Disconnect"
              >
                Disconnect
              </ConfirmSubmit>
            )}
          </>
        ) : (
          <>
            <p className="text-sm text-ink-muted">
              Connect the calendar the agent books on. It reads free/busy and
              creates events with a video link.
            </p>
            {canModify && (
              <a
                href={START[provider]}
                className={buttonClass("primary", "sm")}
              >
                Connect {label}
              </a>
            )}
          </>
        )}
        {state.error && (
          <p className="w-full text-sm text-danger">{state.error}</p>
        )}
      </form>
      {connected && canModify && (
        <form action={testAction} className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-ink-muted">
              Read free/busy for the next 72 hours, the way the agent does
              before offering times.
            </p>
            <Button
              type="submit"
              variant="secondary"
              size="sm"
              loading={testing}
            >
              Test connection
            </Button>
          </div>
          {test.ok && test.detail && (
            <Notice tone="success">{test.detail}</Notice>
          )}
          {test.error && <Notice tone="danger">{test.error}</Notice>}
        </form>
      )}
    </div>
  );
}
