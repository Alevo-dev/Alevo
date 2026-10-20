"use client";

import { useRef, useState, type ReactNode } from "react";
import { Button, type ButtonSize, type ButtonVariant } from "./button";
import { Dialog } from "./dialog";

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
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = "Keep",
  tone = "danger",
  busy,
  onConfirm,
  onCancel,
}: DialogProps) {
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
          <Button variant={tone === "danger" ? "danger" : "primary"} onClick={onConfirm} disabled={busy}>
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
  disabled?: boolean;
  className?: string;
  children: ReactNode;
};

/**
 * A submit button for a destructive form action that asks first. Place it
 * inside the `<form action={…}>`; confirming submits that form.
 */
export function ConfirmSubmit({
  title,
  description,
  confirmLabel,
  cancelLabel,
  tone = "danger",
  variant = "danger",
  size,
  disabled,
  className,
  children,
}: SubmitProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);

  return (
    <>
      <Button
        ref={ref}
        type="button"
        variant={variant}
        size={size}
        disabled={disabled}
        className={className}
        onClick={() => setOpen(true)}
      >
        {children}
      </Button>
      <ConfirmDialog
        open={open}
        title={title}
        description={description}
        confirmLabel={confirmLabel}
        cancelLabel={cancelLabel}
        tone={tone}
        busy={disabled}
        onCancel={() => setOpen(false)}
        onConfirm={() => {
          setOpen(false);
          ref.current?.form?.requestSubmit();
        }}
      />
    </>
  );
}
