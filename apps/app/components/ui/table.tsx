import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from "react";
import { cx } from "@/lib/cx";

/** Table inside a `Card padding="none"`: hairline rules, 24px outer gutters. */
export function Table({ className, ...rest }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto">
      <table className={cx("w-full border-collapse text-left text-sm", className)} {...rest} />
    </div>
  );
}

export function Th({ className, ...rest }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      scope="col"
      className={cx(
        "whitespace-nowrap border-b border-hairline px-4 pb-3 pt-4 text-label font-medium text-ink-muted first:pl-6 last:pr-6",
        className,
      )}
      {...rest}
    />
  );
}

export function Tr({ className, ...rest }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cx("group transition-colors hover:bg-raised/50", className)} {...rest} />;
}

export function Td({ className, ...rest }: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cx(
        "border-b border-hairline px-4 py-3.5 align-middle first:pl-6 last:pr-6 group-last:border-b-0",
        className,
      )}
      {...rest}
    />
  );
}

/** Centred muted line for an empty table body. */
export function EmptyRow({ colSpan, children }: { colSpan: number; children: React.ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-6 py-8 text-center text-sm text-ink-muted">
        {children}
      </td>
    </tr>
  );
}
