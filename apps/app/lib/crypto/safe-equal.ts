import { timingSafeEqual } from "node:crypto";

/** Constant-time string compare for signatures and tokens (unequal lengths are simply false). */
export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
