"use client";

import { useState, type ReactNode } from "react";
import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

export const KEYS_DESCRIPTION = "Keys are stored encrypted. Values are never shown again after you save them.";

/** Opens one service's keys and settings in a dialog instead of scrolling the page. */
export function ManageDialog({
  name,
  label,
  description = KEYS_DESCRIPTION,
  children,
}: {
  name: string;
  label?: string;
  description?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" size="sm" variant="secondary" onClick={() => setOpen(true)}>
        {label ?? (
          <>
            <Settings className="size-4" strokeWidth={1.75} aria-hidden="true" />
            <span className="sr-only">{name} settings</span>
          </>
        )}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={name} description={description} size="xl">
        <div className="space-y-4">{children}</div>
      </Dialog>
    </>
  );
}
