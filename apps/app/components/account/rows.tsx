"use client";

import type { ReactNode } from "react";
import { Ellipsis } from "lucide-react";
import { cx } from "@/lib/cx";
import { Menu, type MenuItem } from "@/components/ui/menu";

/** Right-hand pane of the account dialog: a section title over ruled rows. */
export function Pane({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-w-0 flex-1 overflow-y-auto p-6 md:p-8 md:pt-6">
      <h3 className="border-b border-hairline pb-4 text-heading font-semibold text-ink">{title}</h3>
      <div className="divide-y divide-hairline">{children}</div>
    </div>
  );
}

/** One ruled row: label on the left, content on the right (Clerk's layout). */
export function AccountRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 py-5 md:flex-row md:gap-4">
      <div className="w-44 shrink-0 text-sm font-medium text-ink">{label}</div>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

/** The ⋯ options menu on a row entry. */
export function DotMenu({ label, items }: { label: string; items: MenuItem[] }) {
  return (
    <Menu
      aria-label={label}
      align="end"
      buttonClassName="inline-flex size-8 shrink-0 items-center justify-center rounded-sm text-ink-muted transition-colors hover:bg-raised hover:text-ink"
      button={<Ellipsis className="size-4" strokeWidth={1.75} aria-hidden="true" />}
      groups={[items]}
    />
  );
}

/** Inline text action (Clerk's blue links: Update profile, Set password…). */
export function LinkButton({
  onClick,
  danger,
  disabled,
  className,
  children,
}: {
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cx(
        "text-sm font-medium hover:underline disabled:cursor-not-allowed disabled:opacity-50",
        danger ? "text-danger" : "text-link",
        className,
      )}
    >
      {children}
    </button>
  );
}
