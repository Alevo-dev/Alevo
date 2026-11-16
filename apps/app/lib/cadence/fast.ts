import "server-only";
import { getPlatformSecret } from "@alevo/db";

/**
 * Fast cadence, for testing: follow-ups after 20s / 30s / 40s instead of 1d / 3d / 3d, and the no-reply alert after
 * 30s instead of 5m. On when `CADENCE_FAST=1` is set, or the switch under Admin console → Settings → Testing is on.
 * The switch is read at most every 15 seconds, so a change takes effect within that; a run already waiting keeps
 * the timings it started with.
 */
let cached: { at: number; on: boolean } | null = null;

export async function isFastCadence(now = Date.now()): Promise<boolean> {
  if (process.env.CADENCE_FAST === "1") return true;
  if (cached && now - cached.at < 15_000) return cached.on;
  let on = false;
  try {
    on = (await getPlatformSecret("cadence_fast")) === "1";
  } catch {
    // an unreadable setting never changes the timings
  }
  cached = { at: now, on };
  return on;
}
