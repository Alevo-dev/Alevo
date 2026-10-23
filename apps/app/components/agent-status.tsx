import Link from "next/link";
import { StatusDot } from "@/components/ui/pill";
import { cx } from "@/lib/cx";

/**
 * The agent's live state, always in the shell. Links to Workspace → Agent.
 * - Default (sidebar): a row like the theme control — "Agent: Online / Offline".
 * - `compact` (phone top bar): a blinking dot when online; dot + "Offline" when off.
 */
export function AgentStatus({ on, compact = false, className }: { on: boolean; compact?: boolean; className?: string }) {
  const label = on ? "Online" : "Offline";

  if (compact) {
    return (
      <Link
        href="/workspace/agent"
        aria-label={`Agent ${label.toLowerCase()}`}
        className={cx(
          "inline-flex h-8 items-center gap-1.5 rounded-full px-2 text-label font-medium text-ink-muted no-underline hover:bg-raised hover:text-ink",
          className,
        )}
      >
        <StatusDot tone={on ? "brand" : "muted"} live={on} />
        {on ? null : <span>{label}</span>}
      </Link>
    );
  }

  return (
    <Link
      href="/workspace/agent"
      className={cx("flex items-center justify-between gap-3 text-label text-ink-muted no-underline hover:text-ink", className)}
    >
      <span className="inline-flex items-center gap-2 font-medium text-ink">
        <StatusDot tone={on ? "brand" : "muted"} live={on} />
        Agent: {label}
      </span>
      <span>Manage</span>
    </Link>
  );
}
