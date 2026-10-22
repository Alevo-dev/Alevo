import type { ReactNode } from "react";
import Link from "next/link";
import { buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusDot } from "@/components/ui/pill";
import type { ServiceView } from "@/lib/integrations/services";
import { BrandMark } from "@/components/workspace/brand-mark";
import { ManageDialog } from "./manage-dialog";

/** One connected service: brand mark, name, state, and a Manage dialog with its keys. */
export function ServiceCard({ service, manage }: { service: ServiceView; manage: ReactNode }) {
  return (
    <Card as="article" padding="sm" className="flex flex-col gap-4 p-5">
      <div className="flex items-center gap-3">
        <BrandMark icon={service.icon} />
        <div className="min-w-0">
          <h3 className="font-sans text-sm font-semibold text-ink">{service.name}</h3>
          <p className="text-label text-ink-muted">{service.hint}</p>
        </div>
      </div>

      <div className="mt-auto flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2 text-label font-medium text-ink">
          <StatusDot tone={service.status.tone} />
          {service.status.label}
        </span>
        {service.managed && <ManageDialog name={service.name}>{manage}</ManageDialog>}
      </div>
    </Card>
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
