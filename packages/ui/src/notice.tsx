import { cx } from "./cx";

type NoticeTone = "info" | "success" | "warning" | "danger";

const TONE: Record<NoticeTone, string> = {
  info: "border-hairline bg-brand-soft text-ink",
  success: "border-success/40 bg-success/10 text-ink",
  warning: "border-warning/40 bg-warning/10 text-ink",
  danger: "border-danger/40 bg-danger/10 text-danger",
};

/** Inline message panel (form-level errors, connection results). */
export function Notice({ tone = "info", children, className }: { tone?: NoticeTone; children: React.ReactNode; className?: string }) {
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cx("rounded-md border p-3 text-sm", TONE[tone], className)}>
      {children}
    </div>
  );
}
