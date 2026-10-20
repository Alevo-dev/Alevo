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

/** Title row with an optional right-hand slot (a count, a live indicator). */
export function CardHeader({
  title,
  hint,
  aside,
}: {
  title: string;
  hint?: string;
  aside?: React.ReactNode;
}) {
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
