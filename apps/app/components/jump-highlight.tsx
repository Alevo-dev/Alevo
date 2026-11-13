"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * After a jump link (lib/jump.ts) lands, scroll to the section its hash points at and flash it.
 * `:target` can't do it: client navigation pushes the hash without updating it.
 * The section may still be streaming in, so look for it for a few seconds.
 * ponytail: runs per page change only; a hash link within the same page needs its own trigger.
 */
export function JumpHighlight() {
  const pathname = usePathname();
  useEffect(() => {
    const id = decodeURIComponent(location.hash.slice(1));
    if (!id) return;
    let el: HTMLElement | null = null;
    let off = 0;
    const find = window.setInterval(() => {
      el = document.getElementById(id);
      if (!el) return;
      window.clearInterval(find);
      // A page opened straight on the hash scrolled before this section streamed in.
      el.scrollIntoView({ block: "start" });
      el.classList.add("jump-flash");
      off = window.setTimeout(() => el?.classList.remove("jump-flash"), 2000);
    }, 100);
    const giveUp = window.setTimeout(() => window.clearInterval(find), 4000);
    return () => {
      window.clearInterval(find);
      window.clearTimeout(giveUp);
      window.clearTimeout(off);
      el?.classList.remove("jump-flash");
    };
  }, [pathname]);
  return null;
}
