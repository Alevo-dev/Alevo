import type { InputHTMLAttributes, LabelHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cx } from "./cx";

/** Shared control chrome (32px, 6px radius, sunken ground). `invalid` gives the
 *  red border; the message goes below. `inline` drops the full width for
 *  controls that sit in a row or a table cell. Textareas override the height. */
export function controlClass(invalid?: boolean, className?: string, inline = false): string {
  return cx(
    inline ? "w-auto" : "w-full",
    "h-8 rounded-xs border bg-sunken px-2.5 text-sm text-ink transition-[border-color] duration-150 ease-out",
    "disabled:cursor-not-allowed disabled:opacity-50",
    invalid ? "border-danger" : "border-control",
    className,
  );
}

type Invalid = { invalid?: boolean; inline?: boolean };

export function Input({ invalid, inline, className, ...rest }: InputHTMLAttributes<HTMLInputElement> & Invalid) {
  return <input aria-invalid={invalid || undefined} className={controlClass(invalid, className, inline)} {...rest} />;
}

export function Textarea({ invalid, inline, className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & Invalid) {
  return (
    <textarea
      aria-invalid={invalid || undefined}
      className={controlClass(invalid, cx("h-auto resize-y py-2 leading-[19px]", className), inline)}
      {...rest}
    />
  );
}

export function Label({ className, ...rest }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cx("block text-label font-[550] text-ink", className)} {...rest} />;
}

export function Hint({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cx("text-label text-ink-muted", className)}>{children}</p>;
}

export function FieldError({ children }: { children?: string | null }) {
  if (!children) return null;
  return <p className="mt-1 text-label text-danger">{children}</p>;
}

/** Label + hint + control + error, stacked on a 6px rhythm. */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string | null;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("flex flex-col gap-1.5", className)}>
      <div>
        <Label htmlFor={htmlFor}>{label}</Label>
        {hint && <Hint className="mt-0.5">{hint}</Hint>}
      </div>
      {children}
      <FieldError>{error}</FieldError>
    </div>
  );
}
