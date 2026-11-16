"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { ToolDialog } from "@/components/workspace/tool-dialog";
import { dialogMeta } from "@/lib/integrations/dialog-meta";
import type { ServiceIcon } from "@/lib/integrations/services";
import type { Tone } from "@/lib/ui/status";


/**
 * A row's actions (the board's `.i-act`): an optional "Finish setup" that opens the dialog, then the gear (32px
 * square, `sr-only` name) that opens one service's keys and settings in a dialog instead of scrolling the page.
 * Tests live inside the dialog only.
 */
export function ManageDialog({
  serviceId,
  icon,
  status,
  name,
  actionLabel,
  description,
  className,
  children,
}: {
  serviceId: string;
  icon: ServiceIcon;
  status?: { label: string; tone: Tone };
  name: string;
  actionLabel?: string;
  description?: string;
  /** Placement of the buttons in the row's grid. */
  className?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  // A "Needs attention" link (`#communication:slack`) opens this tool's window, on arrival or on the same page.
  useEffect(() => {
    const check = () => {
      if (decodeURIComponent(location.hash).endsWith(`:${serviceId}`)) setOpen(true);
    };
    check();
    window.addEventListener("hashchange", check);
    return () => window.removeEventListener("hashchange", check);
  }, [serviceId]);
  return (
    <>
      <span className={`flex justify-end gap-1.5 ${className ?? ""}`}>
        {actionLabel && <Button onClick={() => setOpen(true)}>{actionLabel}</Button>}
        <IconButton onClick={() => setOpen(true)}>
          <Settings className="size-[18px]" strokeWidth={1.75} aria-hidden="true" />
          <span className="sr-only">Manage {name}</span>
        </IconButton>
      </span>
      <ToolDialog open={open} onClose={() => setOpen(false)} icon={icon} title={name} status={status} {...dialogMeta(serviceId, description)}>
        {children}
      </ToolDialog>
    </>
  );
}
