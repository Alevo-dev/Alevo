import { cn } from "cn";

/**
 * Alevo "A" monogram — traced from the brand icon: a rounded-top blue left leg,
 * a violet right leg with a folded apex, and a light-blue comet swoosh.
 * (Recreation — for the exact source art, drop it in /public and swap this.)
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={cn("size-8", className)}
      role="img"
      aria-label="Alevo"
    >
      <defs>
        <linearGradient
          id="alevo-blue"
          x1="15"
          y1="51"
          x2="32"
          y2="14"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#3b82f6" />
          <stop offset="1" stopColor="#62b3ff" />
        </linearGradient>
        <linearGradient
          id="alevo-violet"
          x1="32"
          y1="14"
          x2="49"
          y2="51"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#8b5cf6" />
          <stop offset="1" stopColor="#a855f7" />
        </linearGradient>
        <linearGradient
          id="alevo-swoosh"
          x1="7"
          y1="46"
          x2="60"
          y2="21"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#38bdf8" />
          <stop offset="1" stopColor="#7dd3fc" />
        </linearGradient>
      </defs>

      {/* legs */}
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d="M32 14 15 51" stroke="url(#alevo-blue)" strokeWidth="12" />
        <path d="M32 14 49 51" stroke="url(#alevo-violet)" strokeWidth="12" />
      </g>
      {/* folded apex */}
      <path d="M30 17 37 20 33 33Z" fill="#6d28d9" opacity="0.85" />
      {/* comet swoosh */}
      <path
        d="M7 46C26 35 45 34 60 21C45 41 27 46 9 49Z"
        fill="url(#alevo-swoosh)"
      />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark />
      <span className="font-display text-xl font-semibold tracking-tight">
        Alevo
      </span>
    </span>
  );
}
