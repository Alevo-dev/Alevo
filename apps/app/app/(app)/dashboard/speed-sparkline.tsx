"use client";

import { useState } from "react";
import { ChartTooltip } from "@/components/ui/chart-tooltip";
import { fmtDuration } from "@/lib/dashboard/window";

export type SpeedPoint = { label: string; seconds: number | null };

const W = 240;
const H = 60;

/**
 * The median reply time per bucket as one violet line, gaps where nothing was
 * answered. Every bucket is a hit band: hovering or focusing it draws a
 * crosshair + dot and shows the median (or "no replies") in a tooltip.
 */
export function SpeedSparkline({ points }: { points: SpeedPoint[] }) {
  const [active, setActive] = useState<number | null>(null);
  const known = points.filter((p) => p.seconds != null) as { label: string; seconds: number }[];
  const n = points.length;
  if (known.length < 2 || n < 2) {
    return (
      <p className="mt-5 flex h-[60px] items-center justify-center rounded-sm bg-raised/40 text-label text-ink-muted">
        {known.length === 0 ? "No replies in this window yet" : "Trend appears after a second period with replies"}
      </p>
    );
  }
  const max = Math.max(1, ...known.map((p) => p.seconds));
  const x = (i: number) => (i * W) / (n - 1);
  const y = (s: number) => 4 + (H - 8) - (s / max) * (H - 8);
  const band = W / (n - 1);
  // One path per run of consecutive known points, so a quiet day shows as a gap.
  const runs: string[] = [];
  let run: string[] = [];
  points.forEach((p, i) => {
    if (p.seconds == null) {
      if (run.length > 1) runs.push(run.join(" "));
      run = [];
      return;
    }
    run.push(`${run.length ? "L" : "M"}${x(i).toFixed(1)} ${y(p.seconds).toFixed(1)}`);
  });
  if (run.length > 1) runs.push(run.join(" "));
  const first = known[0]!;
  const last = known[known.length - 1]!;
  const current = active == null ? null : points[active];

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-5 block h-auto w-full overflow-visible"
        role="img"
        aria-label={`Median reply time from ${fmtDuration(first.seconds)} on ${first.label} to ${fmtDuration(last.seconds)} on ${last.label}`}
      >
        {active != null && (
          <line x1={x(active)} x2={x(active)} y1={0} y2={H} stroke="var(--color-control)" strokeWidth="1" />
        )}
        {runs.map((d, i) => (
          <path
            key={i}
            d={d}
            fill="none"
            stroke="var(--color-violet)"
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
            pathLength="1"
            className="animate-draw"
          />
        ))}
        {current?.seconds != null && active != null && (
          <circle cx={x(active)} cy={y(current.seconds)} r="4" fill="var(--color-surface)" stroke="var(--color-violet)" strokeWidth="2" />
        )}
        {points.map((p, i) => (
          <rect
            key={p.label}
            x={x(i) - band / 2}
            y={0}
            width={band}
            height={H}
            fill="transparent"
            role="img"
            tabIndex={0}
            aria-label={`${p.label}: ${p.seconds == null ? "no replies" : `${fmtDuration(p.seconds)} median`}`}
            onPointerEnter={() => setActive(i)}
            onPointerLeave={() => setActive(null)}
            onFocus={() => setActive(i)}
            onBlur={() => setActive(null)}
            className="outline-none"
          />
        ))}
      </svg>
      {current && active != null && (
        <ChartTooltip
          x={x(active) / W}
          // The svg starts 20px (mt-5) below the box top; place the tip over the dot, or the top for a gap.
          y={current.seconds == null ? 0.3 : 0.3 + 0.7 * (y(current.seconds) / H)}
          value={current.seconds == null ? "—" : fmtDuration(current.seconds)}
          label={current.seconds == null ? `no replies · ${current.label}` : `median · ${current.label}`}
          swatch="var(--color-violet)"
        />
      )}
      <table className="sr-only" aria-label="Median reply time by period">
        <tbody>
          {points.map((p) => (
            <tr key={p.label}>
              <td>{p.label}</td>
              <td>{p.seconds == null ? "no replies" : fmtDuration(p.seconds)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
