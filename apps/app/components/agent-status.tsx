import Link from "next/link";
import { StatusDot } from "@/components/ui/pill";
import { cx } from "@/lib/cx";

/**
 * The agent's live state, always in the top bar. A pill that links to Workspace → Agent:
 * green with a pulsing dot while online, muted with "offline" while off.
 */
export function AgentStatus({ on, className }: { on: boolean; className?: string }) {
  return (
    <Link
      href="/workspace/agent"
      className={cx(
        "inline-flex h-[26px] items-center gap-2 rounded-full border px-2.5 text-label font-medium no-underline transition-colors",
        on
          ? "border-success/50 bg-success/10 text-success hover:bg-success/20"
          : "border-hairline text-ink-muted hover:bg-surface hover:text-ink",
        className,
      )}
    >
      <StatusDot tone={on ? "success" : "muted"} live={on} />
      <span className="hidden sm:inline">Agent {on ? "online" : "offline"}</span>
      <span className="sr-only sm:hidden">Agent {on ? "online" : "offline"}</span>
    </Link>
  );
}
