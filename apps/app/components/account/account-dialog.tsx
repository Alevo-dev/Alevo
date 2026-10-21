"use client";

import { useState } from "react";
import { ShieldCheck, UserRound } from "lucide-react";
import { cx } from "@/lib/cx";
import { Dialog } from "@/components/ui/dialog";
import { ProfileTab } from "./profile-tab";
import { SecurityTab } from "./security-tab";

const TABS = [
  { key: "profile", label: "Profile", icon: UserRound },
  { key: "security", label: "Security", icon: ShieldCheck },
] as const;

type Tab = (typeof TABS)[number]["key"];

/** Our own "Manage account" — Clerk's two-pane Account modal on our surface. */
export function AccountDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("profile");

  return (
    <Dialog open={open} title="Account" onClose={onClose} showClose size="xl" bare>
      <div className="flex max-h-[85dvh] flex-col overflow-hidden rounded-lg md:min-h-120 md:flex-row">
        <aside className="shrink-0 border-b border-hairline bg-canvas/50 px-6 py-5 md:w-56 md:border-b-0 md:border-r md:py-6">
          <h2 className="font-display text-xl font-semibold tracking-tight text-ink">Account</h2>
          <p className="mt-1 text-label text-ink-muted">Manage your account info.</p>
          <nav aria-label="Account sections" className="-mx-1 mt-5 flex gap-1 md:flex-col">
            {TABS.map(({ key, label, icon: Icon }) => {
              const active = tab === key;
              return (
                <button
                  key={key}
                  type="button"
                  aria-current={active ? "page" : undefined}
                  onClick={() => setTab(key)}
                  className={cx(
                    "flex shrink-0 items-center gap-3 rounded-sm px-3 py-2.5 text-sm transition-colors",
                    active
                      ? "bg-brand-soft font-medium text-ink"
                      : "font-medium text-ink-muted hover:bg-raised hover:text-ink",
                  )}
                >
                  <Icon className={cx("size-4", active ? "text-brand" : "text-ink-muted")} strokeWidth={1.75} aria-hidden="true" />
                  {label}
                </button>
              );
            })}
          </nav>
        </aside>
        {tab === "profile" ? <ProfileTab /> : <SecurityTab onDeleted={onClose} />}
      </div>
    </Dialog>
  );
}
