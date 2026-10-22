"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

/** Opens one service's keys and settings in a dialog instead of scrolling the page. */
export function ManageDialog({
  name,
  label = "Manage",
  children,
}: {
  name: string;
  label?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" size="sm" variant="secondary" onClick={() => setOpen(true)}>
        {label}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={name} description="Keys are stored encrypted. Values are never shown again after you save them." size="xl">
        <div className="space-y-4">{children}</div>
      </Dialog>
    </>
  );
}
