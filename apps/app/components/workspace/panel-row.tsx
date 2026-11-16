import { cx } from "@/lib/cx";
import { FieldError } from "@/components/ui/field";

/**
 * A row inside a panel (board `.row`): 200px label + description on the left, the
 * control line on the right, 11px/14px padding, light rule between rows.
 * `SettingRow` is the roomier two-column row; this is the dense one the Workspace boards use.
 */
export function PanelRow({
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
        "grid items-start gap-1.5 border-b border-hairline/60 px-3.5 py-[11px] last:border-b-0 md:grid-cols-[200px_minmax(0,1fr)] md:gap-4",
        className,
      )}
    >
      <div className="font-[550] text-ink">
        <label htmlFor={htmlFor}>{label}</label>
        {hint && <span className="mt-px block text-label font-normal text-ink-muted">{hint}</span>}
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">{children}</div>
        <FieldError>{error}</FieldError>
      </div>
    </div>
  );
}
