"use client";

import { useEffect, useRef } from "react";
import { useAnimationFrame, useReducedMotion } from "motion/react";
import { cn } from "cn";

/**
 * Horizontal name marquee for mobile. Auto-drifts right -> left, and the user
 * can swipe the list left/right to move or fling it (native horizontal scroll).
 * `touch-action: pan-x` keeps vertical page scrolling unaffected. Three
 * identical copies + wrapping give a seamless loop and runway to drag both ways.
 */
export function LogoMarquee({
  names,
  className,
  speed = 45,
}: {
  names: readonly string[];
  className?: string;
  speed?: number; // px per second
}) {
  const reduce = useReducedMotion();
  const scroller = useRef<HTMLDivElement>(null);
  const interacting = useRef(false);
  const resumeTimer = useRef<number>(0);

  // Start in the middle copy so there's room to drag either direction.
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = el.scrollWidth / 3;
  }, []);

  useAnimationFrame((_, delta) => {
    const el = scroller.current;
    if (!el || reduce || interacting.current) return;
    const copy = el.scrollWidth / 3;
    if (copy <= 0) return;
    el.scrollLeft += (speed * delta) / 1000;
    // wrap invisibly (all three copies are identical)
    if (el.scrollLeft > copy * 1.5) el.scrollLeft -= copy;
    else if (el.scrollLeft < copy * 0.5) el.scrollLeft += copy;
  });

  const pause = () => {
    interacting.current = true;
    if (resumeTimer.current) window.clearTimeout(resumeTimer.current);
  };
  const resumeSoon = () => {
    if (resumeTimer.current) window.clearTimeout(resumeTimer.current);
    // let native momentum settle before auto-scroll takes over again
    resumeTimer.current = window.setTimeout(() => {
      interacting.current = false;
    }, 900);
  };

  return (
    <div className={cn("relative", className)}>
      <div
        ref={scroller}
        onPointerDown={pause}
        onPointerUp={resumeSoon}
        onPointerCancel={resumeSoon}
        onTouchStart={pause}
        onTouchEnd={resumeSoon}
        className="flex overflow-x-auto overflow-y-hidden [touch-action:pan-x] scrollbar-none [&::-webkit-scrollbar]:hidden"
      >
        {[0, 1, 2].map((copy) => (
          <div key={copy} className="flex shrink-0" aria-hidden={copy !== 0}>
            {names.map((name) => (
              <span
                key={name}
                className="px-6 font-display text-lg font-semibold whitespace-nowrap text-foreground/45"
              >
                {name}
              </span>
            ))}
          </div>
        ))}
      </div>
      {/* fade the edges into the section background */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-12 bg-linear-to-r from-muted/30 to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-linear-to-l from-muted/30 to-transparent" />
    </div>
  );
}
