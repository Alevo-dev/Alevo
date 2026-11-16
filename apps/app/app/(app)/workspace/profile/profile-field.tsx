"use client";

import { useState } from "react";
import { cx } from "@/lib/cx";

type Props = {
  name: string;
  label: string;
  defaultValue: string;
  /** A long answer: grows with its text. Short ones stay on one line. */
  multiline?: boolean;
  /** Required while the agent is on: a red star after the label. */
  required?: boolean;
  optional?: boolean;
  hint?: string;
  error?: string;
  placeholder?: string;
  type?: "text" | "email" | "tel" | "url";
  /** Shows "n of max" under the field and stops typing at max. */
  max?: number;
};

/**
 * A Profile field (board `.f`): small label above, the value on a bare underline that
 * turns into the brand gradient while you type, hint (or the error) and a count beneath.
 */
export function ProfileField({ name, label, defaultValue, multiline, required, optional, hint, error, placeholder, type = "text", max }: Props) {
  const [len, setLen] = useState(defaultValue.length);
  const id = name;
  const note = error ? `${id}-note` : hint ? `${id}-note` : undefined;
  const control = cx(
    "block w-full border-0 bg-transparent py-1.5 text-[15px] leading-[21px] text-ink outline-none placeholder:text-ink-muted",
    multiline && "field-sizing-content resize-none",
  );
  const shared = {
    id,
    name,
    defaultValue,
    placeholder,
    maxLength: max,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": note,
    "aria-required": required || undefined,
    onInput: (ev: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>) => setLen(ev.currentTarget.value.length),
  };

  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <label htmlFor={id} className="text-[12.5px] font-semibold tracking-[0.02em] text-ink-muted">
        {label}
        {required && (
          <span className="ml-[3px] text-[15px] font-bold leading-[10px] text-danger">
            <span aria-hidden="true">*</span>
            <span className="sr-only"> (required)</span>
          </span>
        )}
        {optional && <em className="ml-1.5 font-medium not-italic text-ink-muted">(optional)</em>}
      </label>
      <div
        className={cx(
          "relative border-b transition-colors duration-150 ease-out",
          "after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-[image:var(--ds-gradient-brand)] after:opacity-0 after:transition-opacity after:duration-150 focus-within:border-transparent focus-within:after:opacity-100",
          error ? "border-danger" : "border-control hover:border-ink-muted",
        )}
      >
        {multiline ? <textarea rows={1} className={control} {...shared} /> : <input type={type} className={control} {...shared} />}
      </div>
      {(error || hint || max) && (
        <div className="flex justify-between gap-3 text-label text-ink-muted">
          <span id={note} className={error ? "text-danger" : undefined}>
            {error ?? hint}
          </span>
          {max && (
            <span className="ml-auto font-mono tabular-nums">
              {len} of {max}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
