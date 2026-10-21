"use client";

import { useState } from "react";
import Image from "next/image";
import { useClerk, useUser } from "@clerk/nextjs";
import { LogOut, Settings } from "lucide-react";
import { initials } from "@/lib/format";
import { AccountDialog } from "@/components/account/account-dialog";
import { Spinner } from "@/components/ui/button";
import { Menu } from "@/components/ui/menu";

/** Our own account menu — Clerk session, Alevo surface, Clerk's shape:
 *  identity on top, Manage account, Sign out. */
export function UserMenu() {
  const { isLoaded, user } = useUser();
  const clerk = useClerk();
  const [signingOut, setSigningOut] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  const email = user?.primaryEmailAddress?.emailAddress;
  const name = user?.fullName || email;

  return (
    <>
      <Menu
        aria-label="Account"
        align="end"
        size="lg"
        disabled={!isLoaded || signingOut}
        buttonClassName="rounded-full"
        button={
          signingOut ? (
            <span className="inline-flex size-8 items-center justify-center text-ink-muted">
              <Spinner />
            </span>
          ) : (
            <UserAvatar imageUrl={user?.hasImage ? user.imageUrl : null} name={name} size="md" />
          )
        }
        header={
          <div className="flex min-w-0 items-center gap-2.5 py-1">
            <UserAvatar imageUrl={user?.hasImage ? user.imageUrl : null} name={name} size="lg" />
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-ink">{name ?? "…"}</div>
              {email && name !== email && <div className="truncate text-label text-ink-muted">{email}</div>}
            </div>
          </div>
        }
        groups={[
          [
            {
              key: "manage",
              label: "Manage account",
              icon: Settings,
              onSelect: () => setAccountOpen(true),
            },
            {
              key: "sign-out",
              label: "Sign out",
              icon: LogOut,
              onSelect: () => {
                setSigningOut(true);
                void clerk.signOut({ redirectUrl: "/sign-in" });
              },
            },
          ],
        ]}
        menuClassName="w-108 max-w-[calc(100vw-16px)]"
      />
      <AccountDialog open={accountOpen} onClose={() => setAccountOpen(false)} />
    </>
  );
}

function UserAvatar({ imageUrl, name, size }: { imageUrl: string | null; name: string | undefined; size: "md" | "lg" }) {
  const px = size === "lg" ? 36 : 32;
  if (imageUrl) {
    return (
      <Image
        src={imageUrl}
        alt=""
        width={px}
        height={px}
        className={size === "lg" ? "size-9 shrink-0 rounded-full object-cover" : "size-8 rounded-full object-cover"}
      />
    );
  }
  return (
    <span
      className={
        size === "lg"
          ? "inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-semibold text-on-brand"
          : "inline-flex size-8 items-center justify-center rounded-full bg-brand text-xs font-semibold text-on-brand"
      }
    >
      {initials(name)}
    </span>
  );
}
