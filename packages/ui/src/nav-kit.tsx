import type { ComponentProps, ReactNode } from "react";
import Link from "next/link";
import { cx } from "./cx";

/** Small count chip (`.chip`): 22px, pill, hairline border. `tone` tints it. */
export function Chip({
  tone = "muted",
  className,
  children,
  ...rest
}: ComponentProps<"span"> & { tone?: "muted" | "brand" | "violet" | "success" | "warning" | "danger" }) {
  const T = {
    muted: "border-hairline text-ink-muted",
    brand: "border-brand/60 bg-brand/10 text-brand-ink",
    violet: "border-violet/60 bg-violet/10 text-violet-ink",
    success: "border-success/55 bg-success/10 text-success",
    warning: "border-warning/55 bg-warning/10 text-warning",
    danger: "border-danger/55 bg-danger/10 text-danger",
  }[tone];
  return (
    <span
      className={cx("inline-flex h-[22px] items-center gap-1.5 whitespace-nowrap rounded-full border px-[9px] text-[12.5px] font-[550]", T, className)}
      {...rest}
    >
      {children}
    </span>
  );
}

/** A count in a perfect circle (20px): the number is centred, never an oval; three digits shrink to fit. */
export function CountDot({ n }: { n: number | string }) {
  return (
    <span
      className={cx(
        "inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-raised font-mono font-normal leading-none tabular-nums text-ink-muted",
        String(n).length > 2 ? "text-[9px]" : "text-[11px]",
      )}
    >
      {n}
    </span>
  );
}

export type NavOption = { key: string; label: ReactNode; href?: string; count?: number | string; onSelect?: () => void };

/** Renders as a link when `href` is set, a button otherwise. */
function Item({ o, className, on }: { o: NavOption; className: string; on: boolean }) {
  const body = (
    <>
      {o.label}
      {o.count != null && <CountDot n={o.count} />}
    </>
  );
  return o.href ? (
    <Link href={o.href} className={className} aria-current={on ? "page" : undefined}>
      {body}
    </Link>
  ) : (
    <button type="button" onClick={o.onSelect} className={className} aria-pressed={on}>
      {body}
    </button>
  );
}

const FOCUS = "outline-none focus-visible:[box-shadow:var(--ds-focus-ring)]";

/** Segmented control (`.seg`): bordered, 32px items (as tall as the inputs beside it), selected = brand-soft. */
export function Seg({ options, value, label, className }: { options: NavOption[]; value: string; label?: string; className?: string }) {
  return (
    <div role="group" aria-label={label} className={cx("inline-flex overflow-hidden rounded-xs border border-control", className)}>
      {options.map((o, i) => (
        <Item
          key={o.key}
          o={o}
          on={o.key === value}
          className={cx(
            "flex h-8 items-center gap-2 px-3.5 text-sm font-[550] transition-colors duration-150 ease-out",
            FOCUS,
            i > 0 && "border-l border-control",
            o.key === value ? "bg-brand-soft text-ink" : "text-ink-muted hover:bg-raised hover:text-ink",
          )}
        />
      ))}
    </div>
  );
}

/** Underlined page tabs (`.tabs`): active = ink text + 2px brand-gradient rule. */
export function Tabs({ options, value, label, className }: { options: NavOption[]; value: string; label?: string; className?: string }) {
  return (
    <nav aria-label={label} className={cx("flex gap-0.5 border-b border-hairline", className)}>
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Item
            key={o.key}
            o={o}
            on={on}
            className={cx(
              "relative -mb-px flex items-center gap-[7px] px-3 py-2 text-[14px] font-[550] transition-colors duration-150 ease-out",
              FOCUS,
              on ? "text-ink" : "text-ink-muted hover:text-ink",
              // 2px rule: transparent when off, the brand gradient when on.
              "after:absolute after:inset-x-0 after:bottom-0 after:h-0.5",
              on && "after:bg-[image:var(--ds-gradient-brand)]",
            )}
          />
        );
      })}
    </nav>
  );
}

/** Sub-tabs look exactly like the page tabs: ink text + 2px brand rule; a count circle only when there is a count. */
export const SubTabs = Tabs;

/** Bordered row of label / value cells (`.info`): sunken ground, 8px radius. */
export function InfoStrip({ items, className }: { items: { label: string; value: ReactNode }[]; className?: string }) {
  return (
    <dl
      className={cx("grid overflow-hidden rounded-sm border border-hairline bg-sunken", className)}
      style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
    >
      {items.map((it) => (
        <div key={it.label} className="min-w-0 border-l border-hairline px-3.5 py-[9px] first:border-l-0">
          <dt className="text-xs font-[550] uppercase tracking-[0.05em] text-ink-muted">{it.label}</dt>
          <dd className="mt-0.5 truncate text-[14px] font-[550] text-ink">{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}
