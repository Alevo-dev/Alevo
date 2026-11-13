"use client";

import { useState } from "react";
import { cx } from "@/lib/cx";
import type { ConnectionHealth, ProviderHealth } from "@/lib/integrations/health";

const W = 640;
const X0 = 48;
const X1 = 632;
const YT = 16;
const YB = 154;

/** Axis floor: 97% when everything is healthy, lower (a multiple of 10) when something is not, so no line leaves the chart. */
function axisFloor(providers: ProviderHealth[]): number {
  const rates = providers.flatMap((p) => p.buckets.filter((b) => b.ok + b.failed > 0).map((b) => (b.ok / (b.ok + b.failed)) * 100));
  const min = rates.length ? Math.min(...rates) : 100;
  return min >= 97 ? 97 : Math.max(0, Math.floor(min / 10) * 10);
}

/** One run of points per stretch of hours that had traffic: a quiet hour is a gap, never an interpolated point. */
function runs(p: ProviderHealth, lo: number): { x: number; y: number }[][] {
  const out: { x: number; y: number }[][] = [];
  let run: { x: number; y: number }[] = [];
  p.buckets.forEach((b, i) => {
    const total = b.ok + b.failed;
    if (total === 0) {
      if (run.length) out.push(run);
      run = [];
      return;
    }
    run.push({
      x: X0 + (i * (X1 - X0)) / (p.buckets.length - 1),
      y: YB - (((b.ok / total) * 100 - lo) / (100 - lo)) * (YB - YT),
    });
  });
  if (run.length) out.push(run);
  return out;
}

const pct = (n: number | null) => (n === null ? "No data" : `${(n * 100).toFixed(1)}%`);

/**
 * Connection health: the success rate of every service over the last 24 hours,
 * one coloured line each, from the webhooks we receive and the API calls we make.
 * A chip per service isolates its line (and its figures); pressing it again shows all.
 */
export function HealthSection({ health }: { health: ConnectionHealth }) {
  const [sel, setSel] = useState<string | null>(null);
  const chosen = health.providers.find((p) => p.provider === sel) ?? null;
  const shown = chosen ? [chosen] : health.providers;
  const head = chosen ?? health;
  const lo = axisFloor(health.providers);
  const ticks = [0, 1, 2, 3].map((i) => ({ y: YT + (i * (YB - YT)) / 3, label: `${Math.round(100 - (i * (100 - lo)) / 3)}%` }));

  return (
    <section aria-labelledby="connection-health">
      <h2 id="connection-health" className="text-heading font-semibold text-ink">
        Connection health
      </h2>
      <p className="mt-2 text-sm text-ink-muted">
        How often each tool succeeded over the last 24 hours, counting the webhooks it sent us and the calls we made to it. Select a tool to look at it on its own; select it again to show all.
      </p>
      <div className="mt-3 h-[3px] w-7 rounded-sm bg-gradient-to-r from-brand to-violet" aria-hidden="true" />

      {health.providers.length === 0 ? (
        <p className="mt-6 rounded-md border border-dashed border-hairline p-4 text-sm text-ink-muted">
          Nothing to show yet. Each tool you connect appears here, and fills in as it sends webhooks or we call it.
        </p>
      ) : (
        <>
          <div className="mt-6 grid items-center gap-10 md:grid-cols-[minmax(0,220px)_minmax(0,1fr)]">
            <div>
              <div className="text-label text-ink-muted">{chosen ? chosen.name : "All tools"}</div>
              <div className="mt-1.5 bg-gradient-to-r from-brand to-violet bg-clip-text font-mono text-5xl font-medium tracking-tight text-transparent">
                {pct(head.successRate)}
              </div>
              <div className="mt-1.5 text-label text-ink-muted">Calls and webhooks that succeeded</div>
              <div className="mt-5 flex items-baseline gap-2">
                <span className="font-mono text-2xl text-ink">{head.failed}</span>
                <span className="text-label text-ink-muted">failed</span>
              </div>
            </div>

            <svg
              viewBox={`0 0 ${W} 220`}
              width="100%"
              role="img"
              aria-label={`Success rate per tool over the last 24 hours. ${chosen ? chosen.name : "All tools"} shown.`}
              className="block overflow-visible"
            >
              <g fontSize="12" className="fill-ink-muted">
                {ticks.map((t) => (
                  <g key={t.label}>
                    <line x1={X0} x2={X1} y1={t.y} y2={t.y} className="stroke-hairline" />
                    <text x={X0 - 8} y={t.y + 4} textAnchor="end">
                      {t.label}
                    </text>
                  </g>
                ))}
                <text x={X0} y={206}>24h ago</text>
                <text x={(X0 + X1) / 2} y={206} textAnchor="middle">12h</text>
                <text x={X1} y={206} textAnchor="end">Now</text>
              </g>
              {shown.map((p) =>
                runs(p, lo).map((run, i) =>
                  run.length > 1 ? (
                    <polyline
                      key={`${p.provider}-${i}`}
                      points={run.map((pt) => `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`).join(" ")}
                      fill="none"
                      stroke={p.color}
                      strokeWidth={chosen ? 4 : 2.5}
                      strokeLinejoin="round"
                      strokeLinecap="round"
                    />
                  ) : (
                    // A single hour with traffic has no line to draw: show it as a dot.
                    <circle key={`${p.provider}-${i}`} cx={run[0]!.x} cy={run[0]!.y} r={chosen ? 4 : 3} fill={p.color} />
                  ),
                ),
              )}
            </svg>
          </div>

          <div role="group" aria-label="Isolate a tool" className="mt-4 flex flex-wrap gap-2">
            {health.providers.map((p) => {
              const on = sel === p.provider;
              return (
                <button
                  key={p.provider}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setSel(on ? null : p.provider)}
                  className={cx(
                    "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-label font-medium text-ink transition-colors",
                    on ? "bg-brand-soft" : "border-hairline hover:bg-raised",
                  )}
                  style={on ? { borderColor: p.color } : undefined}
                >
                  <span className="size-2.5 rounded-[3px]" style={{ background: p.color }} aria-hidden="true" />
                  {p.name}
                  <span className="font-mono text-ink-muted">{pct(p.successRate)}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
