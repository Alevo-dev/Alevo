"use client";

import { UserButton } from "@clerk/nextjs";
import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * Clerk's account button only renders once clerk-js has loaded. If the script wins the
 * race against hydration the client HTML has a node the server HTML lacked, and React
 * logs a hydration mismatch. Render a same-size spacer until hydration is done, then the
 * button; the server snapshot (false) is what hydration sees, so the two always agree.
 */
export function AccountButton() {
  const hydrated = useSyncExternalStore(subscribe, () => true, () => false);
  return hydrated ? <UserButton /> : <div className="size-7" aria-hidden />;
}
