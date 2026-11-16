"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { buttonClass } from "@/components/ui/button";
import { cx } from "@/lib/cx";

/** Re-fetches the server page in place. Icon-only unless given a `label`. */
export function RefreshButton({ label }: { label?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      aria-label={label ? undefined : "Refresh"}
      title={label ? undefined : "Refresh"}
      aria-busy={pending || undefined}
      onClick={() => start(() => router.refresh())}
      className={label ? buttonClass("secondary", "sm") : "inline-flex size-8 shrink-0 items-center justify-center rounded-xs text-ink-muted transition-[color,background-color,transform] duration-150 ease-out hover:bg-raised hover:text-ink active:scale-[0.97] motion-reduce:transition-none"}
    >
      <RefreshCw className={cx(label ? "size-[15px] text-ink-muted" : "size-[18px]", pending && "animate-spin motion-reduce:animate-none")} strokeWidth={1.75} aria-hidden="true" />
      {label}
    </button>
  );
}
