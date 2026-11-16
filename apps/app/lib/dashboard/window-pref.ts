import { cookies } from "next/headers";
import { WINDOW_COOKIE } from "./window-cookie";
import { DEFAULT_WINDOW, parseWindow, type Window } from "./window";

/** The signed-in person's chosen time window (Today, 7, 30 or 90 days), the same on every page. */
export async function readWindow(): Promise<Window> {
  const value = (await cookies()).get(WINDOW_COOKIE)?.value;
  return value ? parseWindow(value) : DEFAULT_WINDOW;
}
