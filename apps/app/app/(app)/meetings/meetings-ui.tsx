"use client";

import { startTransition, useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Check, Trash2 } from "lucide-react";
import type { BookingProvider, MeetingOutcome, MeetingStatus } from "@alevo/db";
import { Button } from "@/components/ui/button";
import { ConfirmSubmit } from "@/components/ui/confirm-dialog";
import { Dialog } from "@/components/ui/dialog";
import { Field, FieldError, Input } from "@/components/ui/field";
import { IconButton } from "@/components/ui/icon-button";
import { Select, type SelectOption } from "@/components/ui/select";
import { cx } from "@/lib/cx";
import { toast, useActionToast } from "@/lib/ui/use-action-toast";
import { assignMeetingRep, manageMeeting, type ManageState } from "./actions";

const INITIAL: ManageState = {};

const OUTCOMES = [
  { value: "pending", label: "Pending", on: "bg-brand-soft text-ink" },
  { value: "showed", label: "Showed", on: "bg-success/15 text-success" },
  { value: "no_show", label: "No-show", on: "bg-danger/15 text-danger" },
] as const;

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

/** The rep who owns a meeting: a member picker that saves on change (rep and above), plain text for viewers. */
export function RepControl({ id, rep, options, canAssign }: { id: string; rep: string; options: SelectOption[]; canAssign: boolean }) {
  const [state, action, pending] = useActionState(assignMeetingRep, INITIAL);
  useActionToast(state, "Rep updated.");
  const current = options.find((o) => o.value === rep);
  if (!canAssign) return <span className={cx(!rep && "text-ink-muted")}>{current?.label ?? "Unassigned"}</span>;

  return (
    <div className="flex flex-col gap-1">
      <Select
        inline
        size="sm"
        aria-label="Rep"
        options={options}
        value={rep}
        disabled={pending}
        onChange={(next) => next !== rep && startTransition(() => action(formData({ id, rep: next })))}
      />
      <FieldError>{state.error}</FieldError>
    </div>
  );
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
      <div className="flex items-center gap-2.5 whitespace-nowrap">
        <div role="radiogroup" aria-label="Outcome" className="inline-flex overflow-hidden rounded-xs border border-control">
          {OUTCOMES.map((o, i) => {
            const selected = outcome === o.value;
            return (
              <button
                key={o.value}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={pending}
                onClick={() => !selected && startTransition(() => action(formData({ op: "outcome", id, outcome: o.value })))}
                className={cx(
                  "h-[22px] px-2.5 text-[13px] font-[550] transition-colors duration-150 ease-out motion-reduce:transition-none disabled:cursor-wait",
                  i > 0 && "border-l border-control",
                  selected ? o.on : "text-ink-muted hover:bg-raised hover:text-ink",
                )}
              >
                {o.label}
              </button>
            );
          })}
        </div>
        <form action={action}>
          <input type="hidden" name="op" value="converted" />
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="converted" value={converted ? "false" : "true"} />
          <button
            type="submit"
            aria-pressed={converted}
            disabled={pending}
            className={cx(
              "inline-flex items-center gap-1.5 rounded-xs text-[13.5px] transition-colors duration-150 ease-out motion-reduce:transition-none disabled:cursor-wait",
              converted ? "text-ink" : "text-ink-muted hover:text-ink",
            )}
          >
            <span
              aria-hidden="true"
              className={cx("inline-flex size-[18px] items-center justify-center rounded-full", converted ? "bg-success/15 text-success" : "bg-raised text-ink-muted")}
            >
              <Check className="size-3" strokeWidth={2.5} />
            </span>
            Converted
          </button>
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
            icon={Trash2}
            aria-label="Cancel meeting"
            loading={pending}
            title={`Cancel the meeting with ${contact}?`}
            description="The event is removed from the calendar and the contact is told. The conversation reopens so the agent can offer a new time."
            confirmLabel="Cancel meeting"
            cancelLabel="Keep meeting"
          >
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
      <IconButton title="Reschedule" aria-label="Reschedule" onClick={() => setOpen(true)}>
        <CalendarClock className="size-[18px]" strokeWidth={1.75} aria-hidden="true" />
      </IconButton>
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
            <Button variant="primary" onClick={save} loading={pending}>
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
