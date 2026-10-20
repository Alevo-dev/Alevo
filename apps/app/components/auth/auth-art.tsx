import Image from "next/image";
import { StatusDot } from "@/components/ui/pill";

/**
 * Left half of the auth screen: brand gradient with a curved edge, the mark,
 * two illustrative activity cards and the product line. Decorative only.
 */
export function AuthArt() {
  return (
    <section
      aria-hidden="true"
      className="relative h-[260px] w-full overflow-hidden bg-[linear-gradient(160deg,var(--ds-canvas)_0%,var(--ds-brand-soft)_55%,var(--ds-accent-soft)_100%)] md:absolute md:inset-y-0 md:left-0 md:h-auto md:w-1/2 md:[clip-path:url(#auth-curve)]"
    >
      <svg width="0" height="0" className="absolute" aria-hidden="true" focusable="false">
        <defs>
          <clipPath id="auth-curve" clipPathUnits="objectBoundingBox">
            <path d="M0,0 L0.8,0 Q1.0,0.5 0.8,1 L0,1 Z" />
          </clipPath>
        </defs>
      </svg>

      <svg viewBox="0 0 640 860" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full">
        <defs>
          <radialGradient id="auth-glow" cx="0.3" cy="0.35" r="0.6">
            <stop offset="0%" stopColor="var(--ds-brand)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--ds-brand)" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="640" height="860" fill="url(#auth-glow)" />
        <g className="stroke-hairline" strokeWidth="1" opacity="0.7">
          <line x1="0" y1="180" x2="640" y2="180" />
          <line x1="0" y1="520" x2="640" y2="520" />
        </g>
      </svg>

      <Image
        src="/alevo-mark.png"
        alt=""
        width={460}
        height={460}
        priority
        className="absolute left-1/2 top-1/2 w-[200px] max-w-[80%] -translate-x-1/2 -translate-y-1/2 opacity-95 md:w-[460px]"
      />

      <FloatCard className="left-12 top-[120px]">
        <div className="flex items-center justify-between text-xs text-ink-muted">
          <span className="font-mono">14:02:11</span>
          <span className="flex items-center gap-1.5">
            <StatusDot tone="success" />
            12s
          </span>
        </div>
        <div className="mt-2 text-sm font-semibold text-ink">Northbridge IT, SMS</div>
        <div className="mt-1 text-label text-ink-muted">Qualified, booked demo</div>
      </FloatCard>
      <FloatCard className="left-[300px] top-[430px] [animation-delay:-2s]">
        <div className="text-xs text-ink-muted">Next meeting</div>
        <div className="mt-1.5 text-sm font-semibold text-ink">Thu 10:00, Priya Nair</div>
        <div className="mt-1 text-label text-ink-muted">Logged to the PSA</div>
      </FloatCard>

      <div className="absolute bottom-16 left-12 right-[120px] hidden md:block">
        <div className="flex items-center gap-2.5 text-sm text-ink-muted">
          <StatusDot tone="brand" live />
          Live. Leads answered in seconds.
        </div>
        <div className="mt-4 font-display text-[40px] font-bold leading-[44px] tracking-tight text-ink">
          Every lead answered.
        </div>
        <p className="mt-3 max-w-[420px] text-base leading-6 text-ink-muted">
          Chats, forms and calls answered in seconds, then booked into your PSA.
        </p>
      </div>
    </section>
  );
}

function FloatCard({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <div
      className={`absolute hidden w-[260px] animate-bob rounded-lg border border-hairline bg-surface px-4 py-3.5 shadow-float md:block ${className}`}
    >
      {children}
    </div>
  );
}
