import { ExternalLink, ShieldCheck } from "lucide-react";
import { APP_URL } from "@/lib/app-url";
import { AccountButton } from "./account-button";
import { Brand } from "./brand";
import { MobileMenu } from "./mobile-menu";
import { OrgSearch } from "./org-search";

/** Full-width bar above the rail and the page: brand + Console chip, org search, then the app link, the admin chip and the account. */
export function TopBar() {
  return (
    <header className="sticky top-0 z-30 flex h-[46px] shrink-0 items-center gap-4 border-b border-hairline bg-topbar px-4">
      <div className="flex w-auto items-center gap-3 md:w-[204px]">
        <MobileMenu />
        <Brand />
      </div>
      <div className="hidden max-w-[520px] flex-1 md:block">
        <OrgSearch />
      </div>
      <div className="ml-auto flex items-center gap-3.5">
        <a
          href={APP_URL}
          className="hidden h-7 items-center gap-1.5 whitespace-nowrap rounded-xs border border-control px-2.5 text-label font-semibold text-ink no-underline transition-colors hover:bg-raised sm:inline-flex"
        >
          Open the app
          <ExternalLink className="size-3.5 text-ink-muted" strokeWidth={1.75} aria-hidden="true" />
        </a>
        <span className="hidden h-[22px] items-center gap-1.5 whitespace-nowrap rounded-full border border-violet/60 bg-violet/10 px-[9px] text-[12.5px] font-[550] text-violet-ink sm:inline-flex">
          <ShieldCheck className="size-[13px]" strokeWidth={2} aria-hidden="true" />
          Platform admin
        </span>
        <AccountButton />
      </div>
    </header>
  );
}
