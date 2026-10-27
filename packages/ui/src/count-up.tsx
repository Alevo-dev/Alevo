"use client";

import { useEffect, useState } from "react";

const DURATION_MS = 1000;
const ease = (t: number) => 1 - Math.pow(1 - t, 3);
const fmtCount = (n: number) => n.toLocaleString("en-US");

/**
 * A number that counts up from 0 to `value` on mount (and re-runs when the
 * value changes). Tabular figures keep it from jittering; reduced motion
 * shows the final value at once.
 */
export function CountUp({ value, format = fmtCount }: { value: number; format?: (n: number) => string }) {
  const [p, setP] = useState(0);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    const t0 = performance.now();
    const step = (now: number) => {
      const t = reduce ? 1 : Math.min(1, (now - t0) / DURATION_MS);
      setP(ease(t));
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return <span className="tabular">{format(Math.round(value * p))}</span>;
}
