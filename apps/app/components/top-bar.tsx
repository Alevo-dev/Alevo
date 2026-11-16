import Image from "next/image";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import type { UsageRow } from "@alevo/db";
import { AgentStatus } from "./agent-status";
import { MobileMenu } from "./mobile-menu";
import { QuickSearch } from "./quick-search";
import { UserMenu } from "./user-menu";
import { adminUrl } from "@/lib/admin-url";


/** The busiest metered allowance as a 0–100 figure, for the meter in the bar. */
function busiest(rows: UsageRow[]): number | null {
  const metered = rows.filter((r) => r.allowance > 0);
  if (metered.length === 0) return null;
  return Math.min(100, Math.round(Math.max(...metered.map((r) => (r.used / r.allowance) * 100))));
}

/** Full-width bar above the rail and the page: brand, search, then admin link, agent, usage, account. */
export function TopBar({
  agentOn,
  usage,
  hasOrg,
  isPlatformAdmin,
}: {
  agentOn: boolean;
  usage: UsageRow[];
  hasOrg: boolean;
  isPlatformAdmin: boolean;
}) {
  const used = busiest(usage);
  return (
    <header className="sticky top-0 z-30 h-[46px] shrink-0 border-b border-hairline bg-topbar">
      <div className="mx-auto flex h-full max-w-[1480px] items-center gap-4 px-4">
      <div className="flex w-auto items-center gap-3 md:w-[204px]">
        <MobileMenu />
        <Link href="/dashboard" className="flex items-center gap-2.5 text-ink no-underline">
          <Image src="/alevo-mark.png" alt="" width={24} height={24} priority className="size-6" />
          <span className="font-display text-[17px] font-semibold tracking-tight">Alevo</span>
        </Link>
      </div>
      <div className="hidden max-w-[520px] flex-1 md:block">{hasOrg && <QuickSearch />}</div>
      <div className="ml-auto flex items-center gap-3.5">
        {isPlatformAdmin && (
          <a
            href={adminUrl()}
            title="Visible to platform admins only"
            className="hidden h-7 items-center gap-1.5 whitespace-nowrap rounded-xs border border-violet bg-violet/15 px-2.5 text-label font-semibold text-violet-light no-underline transition-colors hover:bg-violet/30 hover:text-ink sm:inline-flex"
          >
            <ShieldCheck className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
            Admin console
          </a>
        )}
        {hasOrg && <AgentStatus on={agentOn} />}
        {used !== null && (
          <Link href="/preferences" className="hidden items-center gap-2 text-label text-ink-muted no-underline hover:text-ink lg:flex" aria-label={`Plan usage ${used}%`}>
            Usage
            <span className="block h-[5px] w-[72px] overflow-hidden rounded-full bg-raised" aria-hidden="true">
              <span className="block h-full bg-[linear-gradient(100deg,var(--ds-brand-sky),var(--ds-accent-light))]" style={{ width: `${used}%` }} />
            </span>
            <span className="font-mono">{used}%</span>
          </Link>
        )}
        <UserMenu />
      </div>
      </div>
    </header>
  );
}
