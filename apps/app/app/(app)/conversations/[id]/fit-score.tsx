"use client";

import { useEffect, useState } from "react";

const R = 40;
const CIRC = 2 * Math.PI * R;
const DURATION_MS = 1200;

/** Ease-out cubic: fast start, settles gently. */
const ease = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * The 0–100 fit score as a ring. On load the ring sweeps from empty to the
 * score and the number counts up with it (skipped under reduced motion).
 */
export function FitScore({ score }: { score: number | null }) {
  const pct = score == null ? 0 : Math.max(0, Math.min(100, score));
  const label =
    score == null ? "Not scored yet" : score >= 70 ? "Strong fit" : score >= 40 ? "Possible fit" : "Weak fit";

  // 0 → 1 progress of the intro animation, driven by requestAnimationFrame.
  const [p, setP] = useState(0);
  useEffect(() => {
    if (score == null) return;
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
  }, [score]);

  const shown = score == null ? null : Math.round(pct * p);

  return (
    <div className="flex items-center gap-5">
      <svg
        width="96"
        height="96"
        viewBox="0 0 96 96"
        role="img"
        aria-label={score == null ? "Fit score not set" : `Fit score ${score} of 100`}
        className="shrink-0"
      >
        <circle cx="48" cy="48" r={R} fill="none" className="stroke-raised" strokeWidth="8" />
        {score != null && (
          <circle
            cx="48"
            cy="48"
            r={R}
            fill="none"
            className="stroke-brand"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={CIRC}
            strokeDashoffset={CIRC * (1 - (pct * p) / 100)}
            transform="rotate(-90 48 48)"
          />
        )}
        <text x="48" y="55" textAnchor="middle" className="tabular fill-ink font-mono text-[20px] font-medium">
          {shown ?? "—"}
        </text>
      </svg>
      <div>
        <div className="text-label text-ink-muted">Fit score</div>
        <div className="mt-1 text-sm font-semibold text-ink">{label}</div>
        <div className="mt-1 text-label text-ink-muted">Out of 100</div>
      </div>
    </div>
  );
}
