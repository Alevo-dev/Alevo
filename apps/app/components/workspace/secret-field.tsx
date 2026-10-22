"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { FieldError, Input } from "@/components/ui/field";
import { Pill } from "@/components/ui/pill";
import { cx } from "@/lib/cx";
import { FIELD_PREFIX, type KeyField } from "@/lib/secrets-registry";

export type { KeyField } from "@/lib/secrets-registry";

/**
 * One secret in a settings form: label, help, Set/Not set pill, and a
 * controlled input named `secret.<key>` (blank = keep the stored value).
 * Rule 13: red border + the message directly beneath.
 */
export function SecretField({
  field,
  value,
  error,
  canReveal,
  canModify,
  onChange,
}: {
  field: KeyField;
  value: string;
  error?: string;
  canReveal: boolean;
  canModify: boolean;
  onChange: (next: string) => void;
}) {
  const [showValue, setShowValue] = useState(false);
  const id = `secret-${field.secretKey}`;
  const isPassword = field.inputType === "password";

  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div>
          <label htmlFor={id} className="text-sm font-semibold text-ink">
            {field.label}
          </label>
          <p className="mt-1 text-label text-ink-muted">{field.help}</p>
        </div>
        <Pill tone={field.isSet ? "success" : "muted"}>{field.isSet ? "Set" : "Not set"}</Pill>
      </div>
      <div className="relative">
        <Input
          id={id}
          name={`${FIELD_PREFIX}${field.secretKey}`}
          type={isPassword && !showValue ? "password" : "text"}
          autoComplete="off"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          invalid={!!error}
          disabled={!canModify}
          placeholder={field.isSet ? "Enter a new value to replace" : field.placeholder}
          className={cx("font-mono text-label", isPassword && canReveal && "pr-11")}
        />
        {isPassword && canReveal && (
          <button
            type="button"
            onClick={() => setShowValue((s) => !s)}
            aria-label={showValue ? "Hide value" : "Show value"}
            aria-pressed={showValue}
            className="absolute right-1 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-sm text-ink-muted hover:text-ink"
          >
            {showValue ? <EyeOff className="size-4" strokeWidth={1.75} /> : <Eye className="size-4" strokeWidth={1.75} />}
          </button>
        )}
      </div>
      <FieldError>{error}</FieldError>
    </div>
  );
}
