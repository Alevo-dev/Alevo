import type { HTMLAttributes } from "react";
import { cx } from "./cx";

type CardProps = HTMLAttributes<HTMLElement> & {
  /** `md` = 14px, `sm` = 12px, `none` = a table that bleeds to the edge. Only applies to a boxed card. */
  padding?: "none" | "sm" | "md";
  /** A bordered box. Off by default: a card is a flat section (heading, hairline, content on the page).
   *  Tables, charts and tiles pass `boxed`; forms and lists stay flat. */
  boxed?: boolean;
  as?: "section" | "div" | "article";
};

/** Flat section by default; `boxed` draws surface, hairline and an 8px radius.
 *  `--card-pad` lets a `CardHeader` bleed to the box edge whatever the padding. */
export function Card({ padding = "md", boxed, as: Tag = "section", className, ...rest }: CardProps) {
  const box = !!boxed;
  return (
    <Tag
      data-boxed={box || undefined}
      className={cx(
        "group/card min-w-0",
        box && "rounded-sm border border-hairline bg-surface",
        box && padding === "md" && "p-3.5 [--card-pad:14px]",
        box && padding === "sm" && "p-3 [--card-pad:12px]",
        box && padding === "none" && "overflow-hidden",
        className,
      )}
      {...rest}
    />
  );
}

/** Bottom strip of a `padding="none"` card: a "View all" link, or the pager. */
export function CardFooter({ as: Tag = "div", className, ...rest }: HTMLAttributes<HTMLElement> & { as?: "div" | "nav" }) {
  return <Tag className={cx("flex items-center justify-between gap-3 border-t border-hairline px-3.5 py-[7px] text-label text-ink-muted", className)} {...rest} />;
}

export function CardTitle({ className, ...rest }: HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cx("font-display text-[14px] font-semibold leading-5 text-ink", className)} {...rest} />;
}

export function CardHint({ className, ...rest }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cx("text-label text-ink-muted", className)} {...rest} />;
}

/**
 * Section heading: hairline underneath (in a boxed card it bleeds to the box edge, no shaded bar). Title (+ optional hint) on the left; `aside` (a count / live
 * indicator) or `control` (the section's on/off switch, labelled by the title
 * via `controlId`) on the right.
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
  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-0.5 border-b border-hairline pb-2 group-data-[boxed]/card:-mx-[var(--card-pad,0px)] group-data-[boxed]/card:-mt-[var(--card-pad,0px)] group-data-[boxed]/card:mb-[var(--card-pad,0px)] group-data-[boxed]/card:px-3.5 group-data-[boxed]/card:py-[9px]">
      <CardTitle>{control && controlId ? <label htmlFor={controlId} className="cursor-pointer">{title}</label> : title}</CardTitle>
      {hint && <CardHint>{hint}</CardHint>}
      {(control || aside) && (
        <div className={cx("ml-auto flex items-center gap-2", !control && "text-label text-ink-muted")}>{control ?? aside}</div>
      )}
    </div>
  );
}
