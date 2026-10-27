"use client";

import { useRef, useState, type ComponentType, type ReactNode } from "react";
import { Button, type ButtonSize, type ButtonVariant } from "./button";
import { Dialog } from "./dialog";
import { IconButton } from "./icon-button";

type DialogProps = {
  open: boolean;
  title: string;
  description?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  /** `danger` for delete/cancel/remove; `primary` for a non-destructive commit. */
  tone?: "danger" | "primary";
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/** "Are you sure?" on our own surface, never window.confirm. */
export function ConfirmDialog({ open, title, description, confirmLabel, cancelLabel = "Keep", tone = "danger", busy, onConfirm, onCancel }: DialogProps) {
  return (
    <Dialog
      open={open}
      title={title}
      description={description}
      onClose={onCancel}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button variant={tone === "danger" ? "danger" : "primary"} onClick={onConfirm} loading={busy}>
            {busy ? "Working…" : confirmLabel}
          </Button>
        </>
      }
    />
  );
}

type SubmitProps = {
  title: string;
  description?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "danger" | "primary";
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Submit the enclosing form to THIS action instead of the form's own
   *  (a destructive secondary action inside a settings form, e.g. Disconnect). */
  formAction?: string | ((formData: FormData) => void | Promise<void>);
  /** The action is in flight: spinner on the trigger, dialog buttons busy. */
  loading?: boolean;
  disabled?: boolean;
  className?: string;
  /** Render the trigger as an icon-only button (e.g. a red trash can for removes).
   *  Pass the icon component; `aria-label` is required when used. */
  icon?: ComponentType<{ className?: string; strokeWidth?: number; "aria-hidden"?: boolean }>;
  "aria-label"?: string;
  children?: ReactNode;
};

/**
 * A submit button for a destructive form action that asks first. Place it
 * inside the `<form action={…}>`; confirming submits that form. Pass `icon`
 * for the compact red trash-can trigger used on remove/delete rows.
 */
export function ConfirmSubmit({
  title,
  description,
  confirmLabel,
  cancelLabel,
  tone = "danger",
  variant = "danger",
  size,
  loading = false,
  disabled,
  className,
  icon: Icon,
  formAction,
  children,
  ...aria
}: SubmitProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  // Hidden real submit button carrying `formAction`; confirming submits via it.
  const submitRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      {Icon ? (
        <IconButton
          ref={ref}
          tone={tone === "danger" ? "danger" : "default"}
          loading={loading}
          disabled={disabled}
          className={className}
          onClick={() => setOpen(true)}
          aria-label={aria["aria-label"]}
        >
          <Icon className="size-4" strokeWidth={1.75} aria-hidden />
        </IconButton>
      ) : (
        <Button ref={ref} type="button" variant={variant} size={size} loading={loading} disabled={disabled} className={className} onClick={() => setOpen(true)}>
          {children}
        </Button>
      )}
      {formAction && <button ref={submitRef} type="submit" formAction={formAction} hidden tabIndex={-1} aria-hidden />}
      <ConfirmDialog
        open={open}
        title={title}
        description={description}
        confirmLabel={confirmLabel}
        cancelLabel={cancelLabel}
        tone={tone}
        busy={loading}
        onCancel={() => setOpen(false)}
        onConfirm={() => {
          setOpen(false);
          ref.current?.form?.requestSubmit(submitRef.current ?? undefined);
        }}
      />
    </>
  );
}
