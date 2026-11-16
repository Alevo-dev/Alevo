"use client";

import { useState, type ReactNode } from "react";
import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Dialog } from "@/components/ui/dialog";

export const KEYS_DESCRIPTION = "Keys are stored encrypted. Values are never shown again after you save them.";

/**
 * A row's actions (the board's `.i-act`): an optional "Finish setup" that opens the dialog, then the gear (32px
 * square, `sr-only` name) that opens one service's keys and settings in a dialog instead of scrolling the page.
 * Tests live inside the dialog only.
 */
export function ManageDialog({
  name,
  actionLabel,
  description = KEYS_DESCRIPTION,
  className,
  children,
}: {
  name: string;
  actionLabel?: string;
  description?: string;
  /** Placement of the buttons in the row's grid. */
  className?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <span className={`flex justify-end gap-1.5 ${className ?? ""}`}>
        {actionLabel && <Button onClick={() => setOpen(true)}>{actionLabel}</Button>}
        <IconButton onClick={() => setOpen(true)}>
          <Settings className="size-[18px]" strokeWidth={1.75} aria-hidden="true" />
          <span className="sr-only">Manage {name}</span>
        </IconButton>
      </span>
      <Dialog open={open} onClose={() => setOpen(false)} title={name} description={description} size="xl">
        <div className="space-y-4">{children}</div>
      </Dialog>
    </>
  );
}
