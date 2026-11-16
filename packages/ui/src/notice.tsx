import { cx } from "./cx";

type NoticeTone = "info" | "success" | "warning" | "danger";

/** The boards' `.note`: 8px radius, tone border + 7% tint, 13.5px. */
const TONE: Record<NoticeTone, string> = {
  info: "border-brand/60 bg-brand/[0.07] text-brand-ink",
  success: "border-success/55 bg-success/[0.07] text-success",
  warning: "border-warning/55 bg-warning/[0.07] text-warning",
  danger: "border-danger/55 bg-danger/[0.07] text-danger",
};

/** Inline message panel (form-level errors, connection results). */
export function Notice({ tone = "info", children, className }: { tone?: NoticeTone; children: React.ReactNode; className?: string }) {
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cx("rounded-sm border px-3 py-[9px] text-[13.5px]", TONE[tone], className)}>
      {children}
    </div>
  );
}
