"use client";

import { useEffect, useState, useSyncExternalStore, type RefObject } from "react";

const REDUCE = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange: () => void) {
  const mq = window.matchMedia(REDUCE);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

/** The visitor's reduced-motion preference, live (false during SSR). The platform's own query — no animation library needed. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(REDUCE).matches,
    () => false,
  );
}

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
