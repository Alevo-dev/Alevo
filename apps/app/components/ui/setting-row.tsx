import { cx } from "@/lib/cx";
import { FieldError, Hint } from "./field";

/**
 * A settings row: name + hint on the left, the control on the right. Rows
 * inside one card are separated by hairlines (first row has none).
 */
export function SettingRow({
  label,
  htmlFor,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  hint?: React.ReactNode;
  error?: string | null;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "grid gap-3 border-t border-hairline py-5 first:border-t-0 first:pt-0 last:pb-0 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] md:gap-6",
        className,
      )}
    >
      <div>
        <label htmlFor={htmlFor} className="block text-sm font-semibold text-ink">
          {label}
        </label>
        {hint && <Hint className="mt-1">{hint}</Hint>}
      </div>
      <div className="min-w-0">
        {children}
        <FieldError>{error}</FieldError>
      </div>
    </div>
  );
}
