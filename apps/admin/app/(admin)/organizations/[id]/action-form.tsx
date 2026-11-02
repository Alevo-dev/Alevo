"use client";

import { useActionState, type ReactNode } from "react";
import { Button, type ButtonSize, type ButtonVariant } from "@alevo/ui/button";
import { ConfirmSubmit } from "@alevo/ui/confirm-dialog";
import { Notice } from "@alevo/ui/notice";
import type { OrgActionState } from "../actions";

type Action = (prev: OrgActionState, formData: FormData) => Promise<OrgActionState>;
const INITIAL: OrgActionState = {};

/**
 * One hidden-field form around an org-page server action: the fields it needs,
 * a button (or a ConfirmSubmit when `confirm` is given), the error beneath.
 * Success re-renders the page through the action's revalidatePath.
 */
export function ActionForm({
  action,
  fields,
  children,
  variant = "secondary",
  size = "sm",
  confirm,
  className,
}: {
  action: Action;
  fields: Record<string, string>;
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Ask first (destructive): the dialog's title, one sentence, and the confirm label. */
  confirm?: { title: string; description: string; confirmLabel: string };
  className?: string;
}) {
  const [state, dispatch, pending] = useActionState(action, INITIAL);
  return (
    <form action={dispatch} className={className}>
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {confirm ? (
        <ConfirmSubmit {...confirm} loading={pending} variant={variant} size={size}>
          {children}
        </ConfirmSubmit>
      ) : (
        <Button type="submit" variant={variant} size={size} loading={pending}>
          {children}
        </Button>
      )}
      {state.error && (
        <Notice tone="danger" className="mt-2">
          {state.error}
        </Notice>
      )}
    </form>
  );
}
