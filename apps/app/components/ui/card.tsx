import type { HTMLAttributes } from "react";
import { cx } from "@/lib/cx";

type CardProps = HTMLAttributes<HTMLElement> & {
  /** `md` = 24px (default), `sm` = 16px tiles, `none` = tables that bleed to the edge. */
  padding?: "none" | "sm" | "md";
  as?: "section" | "div" | "article";
};

/** Surface on canvas: lighter fill plus a hairline, no shadow (depth on dark). */
export function Card({ padding = "md", as: Tag = "section", className, ...rest }: CardProps) {
  return (
    <Tag
      className={cx(
        "min-w-0 rounded-lg border border-hairline bg-surface",
        padding === "md" && "p-6",
        padding === "sm" && "p-4",
        padding === "none" && "overflow-hidden",
        className,
      )}
      {...rest}
    />
  );
}

export function CardTitle({ className, ...rest }: HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cx("text-heading font-semibold text-ink", className)} {...rest} />;
}

export function CardHint({ className, ...rest }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cx("mt-2 text-sm text-ink-muted", className)} {...rest} />;
}

/**
 * Title row with an optional right-hand slot: `aside` for a count / live
 * indicator, or `control` for the section's on/off switch, which sits on the
 * title line (centred with it) and is labelled by the title via `controlId`.
 */
export function CardHeader({
  title,
  hint,
  aside,
  control,
  controlId,
}: {
  title: string;
  hint?: React.ReactNode;
  aside?: React.ReactNode;
  control?: React.ReactNode;
  controlId?: string;
}) {
  if (control) {
    return (
      <div>
        <div className="flex items-center justify-between gap-4">
          <CardTitle>{controlId ? <label htmlFor={controlId} className="cursor-pointer">{title}</label> : title}</CardTitle>
          {control}
        </div>
        {hint && <CardHint>{hint}</CardHint>}
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <CardTitle>{title}</CardTitle>
        {hint && <CardHint>{hint}</CardHint>}
      </div>
      {aside && <div className="text-label text-ink-muted">{aside}</div>}
    </div>
  );
}
