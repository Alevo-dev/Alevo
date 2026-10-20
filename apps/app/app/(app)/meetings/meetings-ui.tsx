"use client";

import { startTransition, useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { BookingProvider, MeetingOutcome, MeetingStatus } from "@alevo/db";
import { Button } from "@/components/ui/button";
import { ConfirmSubmit } from "@/components/ui/confirm-dialog";
import { Dialog } from "@/components/ui/dialog";
import { Field, FieldError, Input } from "@/components/ui/field";
import { Select, type SelectOption } from "@/components/ui/select";
import { toast, useActionToast } from "@/lib/ui/use-action-toast";
import { manageMeeting, type ManageState } from "./actions";

const INITIAL: ManageState = {};

const OUTCOME_OPTIONS: readonly SelectOption[] = [
  { value: "pending", label: "Set outcome" },
  { value: "showed", label: "Showed" },
  { value: "no_show", label: "No-show" },
];

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

/** Rep-recorded result: outcome (saves on change) + converted toggle. */
export function OutcomeControls({
  id,
  status,
  outcome,
  converted,
}: {
  id: string;
  status: MeetingStatus;
  outcome: MeetingOutcome;
  converted: boolean;
}) {
  const [state, action, pending] = useActionState(manageMeeting, INITIAL);
  useActionToast(state, "Meeting updated.");
  if (status === "cancelled") return <span className="text-label text-ink-muted">—</span>;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2 whitespace-nowrap">
        <Select
          inline
          size="sm"
          aria-label="Outcome"
          options={OUTCOME_OPTIONS}
          value={outcome}
          disabled={pending}
          onChange={(v) => startTransition(() => action(formData({ op: "outcome", id, outcome: v })))}
        />
        <form action={action}>
          <input type="hidden" name="op" value="converted" />
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="converted" value={converted ? "false" : "true"} />
          <Button type="submit" size="sm" variant={converted ? "primary" : "ghost"} disabled={pending}>
            {converted ? "Converted" : "Mark converted"}
          </Button>
        </form>
      </div>
      <FieldError>{state.error}</FieldError>
    </div>
  );
}

/** Reschedule (in a dialog) + cancel (confirmed) through the booking adapter.
 *  Only for API-managed providers (Cal.com / Google / M365); Calendly and
 *  manual bookings are changed by the contact through their own links. */
export function ManageControls({
  id,
  provider,
  status,
  contact,
}: {
  id: string;
  provider: BookingProvider;
  status: MeetingStatus;
  contact: string;
}) {
  const [state, action, pending] = useActionState(manageMeeting, INITIAL);
  useActionToast(state, "Meeting cancelled.");

  const canManage = provider === "calcom" || provider === "google" || provider === "m365";
  if (status === "cancelled" || !canManage) {
    return <span className="text-label text-ink-muted">{canManage ? "—" : "Via provider"}</span>;
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center justify-end gap-2 whitespace-nowrap">
        <RescheduleDialog id={id} contact={contact} />
        <form action={action}>
          <input type="hidden" name="op" value="cancel" />
          <input type="hidden" name="id" value={id} />
          <ConfirmSubmit
            size="sm"
            disabled={pending}
            title={`Cancel the meeting with ${contact}?`}
            description="The event is removed from the calendar and the contact is told. The conversation reopens so the agent can offer a new time."
            confirmLabel="Cancel meeting"
            cancelLabel="Keep meeting"
          >
            Cancel
          </ConfirmSubmit>
        </form>
      </div>
      <FieldError>{state.error}</FieldError>
    </div>
  );
}

/** Pick a new start time in a dialog, then save through the adapter. */
function RescheduleDialog({ id, contact }: { id: string; contact: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, begin] = useTransition();

  const close = () => {
    setOpen(false);
    setStart("");
    setError(null);
  };

  const save = () => {
    if (!start) {
      setError("Pick a new time.");
      return;
    }
    begin(async () => {
      const res = await manageMeeting(
        INITIAL,
        formData({ op: "reschedule", id, start: new Date(start).toISOString() }),
      );
      if (res.ok) {
        close();
        toast.success("Meeting rescheduled.");
        router.refresh();
      } else {
        setError(res.error ?? "Couldn't reschedule.");
      }
    });
  };

  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
        Reschedule
      </Button>
      <Dialog
        open={open}
        title={`Reschedule with ${contact}`}
        description="The calendar event moves and the contact gets the updated invite."
        onClose={close}
        footer={
          <>
            <Button variant="secondary" onClick={close} disabled={pending}>
              Cancel
            </Button>
            <Button variant="primary" onClick={save} disabled={pending}>
              {pending ? "Saving…" : "Save new time"}
            </Button>
          </>
        }
      >
        <Field label="New start time" htmlFor={`reschedule-${id}`} hint="In your own local time." error={error}>
          <Input
            id={`reschedule-${id}`}
            type="datetime-local"
            value={start}
            invalid={!!error}
            onChange={(e) => {
              setStart(e.target.value);
              setError(null);
            }}
          />
        </Field>
      </Dialog>
    </>
  );
}
