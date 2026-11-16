import type { ReactNode } from "react";
import Link from "next/link";
import { buttonClass } from "@/components/ui/button";
import type { ServiceView } from "@/lib/integrations/services";
import type { Tone } from "@/lib/ui/status";
import { cx } from "@/lib/cx";
import { BrandMark } from "@/components/workspace/brand-mark";
import { ManageDialog } from "./manage-dialog";

const DOT: Record<Tone, string> = {
  brand: "bg-brand",
  violet: "bg-violet",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  muted: "bg-control",
};

/** The state a row shows: a booking tool the agent books through reads "In use for bookings" (blue), the board's wording. */
export function rowStatus(service: ServiceView): { label: string; tone: Tone } {
  return service.setup?.connected && service.setup.chosen ? { label: "In use for bookings", tone: "brand" } : service.status;
}

/** One tool as a row (the board's i-row): mark, name and what it does, its state, and the buttons. */
export function ServiceRow({
  service,
  manage,
  dialogDescription,
}: {
  service: ServiceView;
  manage: ReactNode;
  dialogDescription?: string;
}) {
  const status = rowStatus(service);
  return (
    <li className="grid grid-cols-[30px_minmax(0,1fr)_auto] items-center gap-x-3.5 gap-y-1 border-b border-hairline/70 px-3.5 py-2 transition-colors last:border-b-0 hover:bg-sunken sm:grid-cols-[30px_minmax(0,1fr)_190px_140px]">
      <BrandMark icon={service.icon} size="sm" />
      <div className="min-w-0">
        <p className="font-semibold text-ink">{service.name}</p>
        <p className="text-[12.5px] text-ink-muted">{service.hint}</p>
      </div>
      <span className="col-start-2 row-start-2 inline-flex items-center gap-2 text-[13.5px] font-[550] text-ink sm:col-start-3 sm:row-start-1">
        <span className={cx("size-[7px] shrink-0 rounded-full", DOT[status.tone])} aria-hidden="true" />
        {status.label}
      </span>
      {service.managed ? (
        <ManageDialog
          name={service.name}
          description={dialogDescription}
          actionLabel={service.issue && service.status.label === "Needs setup" ? "Finish setup" : undefined}
          className="col-start-3 row-span-2 row-start-1 sm:col-start-4 sm:row-span-1"
        >
          {manage}
        </ManageDialog>
      ) : null}
    </li>
  );
}

/** Body of a Manage dialog for services whose settings live elsewhere. */
export function ElsewhereNote({ service }: { service: ServiceView }) {
  if (!service.elsewhere) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-hairline p-4">
      <p className="text-sm text-ink-muted">{service.elsewhere.text}</p>
      <Link href={service.elsewhere.href} className={buttonClass("secondary", "sm")}>
        {service.elsewhere.label}
      </Link>
    </div>
  );
}
