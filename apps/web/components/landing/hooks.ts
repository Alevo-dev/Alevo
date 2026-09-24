"use client";

import { useEffect, useState, type RefObject } from "react";
import { useReducedMotion } from "motion/react";

/** Global animation heartbeat — drives all the demo sequences (design: 1150ms). */
export function useTick(intervalMs = 1150) {
  const reduce = useReducedMotion();
  const [t, setT] = useState(0);
  useEffect(() => {
    if (reduce) return;
    const id = setInterval(() => setT((v) => v + 1), intervalMs);
    return () => clearInterval(id);
  }, [reduce, intervalMs]);
  return { t, motion: !reduce };
}

/** Reveal-on-scroll: marks [data-reveal] elements .in as they enter the viewport. */
export function useReveal(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    root.classList.add("rv");
    const els = root.querySelectorAll<HTMLElement>("[data-reveal]");
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.01 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [ref]);
}
