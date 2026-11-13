import type { ReactNode } from "react";
import Link from "next/link";
import { buttonClass } from "@/components/ui/button";
import { StatusDot } from "@/components/ui/pill";
import type { ServiceView } from "@/lib/integrations/services";
import { BrandMark } from "@/components/workspace/brand-mark";
import { ManageDialog } from "./manage-dialog";

/** One connected tool as a row: mark, name and what it does, its state, and a gear that opens its settings. */
export function ServiceRow({
  service,
  manage,
  dialogDescription,
}: {
  service: ServiceView;
  manage: ReactNode;
  dialogDescription?: string;
}) {
  return (
    <li className="grid grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 border-t border-hairline px-3 py-3.5 transition-colors first:border-t-0 hover:bg-surface sm:grid-cols-[40px_minmax(0,1fr)_150px_auto]">
      <BrandMark icon={service.icon} />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-ink">{service.name}</p>
        <p className="text-label text-ink-muted">{service.hint}</p>
      </div>
      <span className="col-start-2 row-start-2 inline-flex items-center gap-2 text-label font-medium text-ink sm:col-start-3 sm:row-start-1">
        <StatusDot tone={service.status.tone} />
        {service.status.label}
      </span>
      <span className="col-start-3 row-span-2 row-start-1 flex justify-end sm:col-start-4 sm:row-span-1">
        {service.managed && (
          <ManageDialog name={service.name} description={dialogDescription}>
            {manage}
          </ManageDialog>
        )}
      </span>
    </li>
  );
}

/** Body of a Manage dialog for services whose settings live elsewhere. */
export function ElsewhereNote({ service }: { service: ServiceView }) {
  if (!service.elsewhere) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-hairline p-4">
      <p className="text-sm text-ink-muted">{service.elsewhere.text}</p>
      <Link href={service.elsewhere.href} className={buttonClass("secondary", "sm")}>
        {service.elsewhere.label}
      </Link>
    </div>
  );
}
