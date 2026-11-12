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
  end,
  stacked,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  hint?: React.ReactNode;
  error?: string | null;
  /** Pushes the control to the row's right edge (a switch), instead of the start of the right column. */
  end?: boolean;
  /** Control below the name and hint, full width, instead of in a right-hand column (a list of options). */
  stacked?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "grid gap-3 border-t border-hairline py-5 first:border-t-0 first:pt-0 last:pb-0",
        !stacked && "md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] md:gap-6",
        className,
      )}
    >
      <div>
        <label htmlFor={htmlFor} className="block text-sm font-semibold text-ink">
          {label}
        </label>
        {hint && <Hint className="mt-1">{hint}</Hint>}
      </div>
      <div className={cx("min-w-0", end && "md:flex md:justify-end")}>
        {children}
        <FieldError>{error}</FieldError>
      </div>
    </div>
  );
}
