import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from "react";
import { cx } from "./cx";

/** Table inside a `Card padding="none"`: sunken sticky head, light row rules. */
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
        "sticky top-0 whitespace-nowrap border-b border-hairline bg-sunken px-2.5 py-[7px] text-[12.5px] font-semibold text-ink-muted first:pl-3.5 last:pr-3.5",
        className,
      )}
      {...rest}
    />
  );
}

export function Tr({ className, ...rest }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cx("group", className)} {...rest} />;
}

export function Td({ className, ...rest }: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cx(
        "border-b border-hairline/60 px-2.5 py-1.5 align-middle transition-colors first:pl-3.5 last:pr-3.5 group-last:border-b-0 group-hover:bg-raised/40",
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
      <td colSpan={colSpan} className="px-3.5 py-8 text-center text-sm text-ink-muted">
        {children}
      </td>
    </tr>
  );
}
