import { ThemeToggle } from "@alevo/ui/theme-toggle";
import { AdminNav } from "./admin-nav";

/** Left rail on desktop (the phone gets the same links in `MobileMenu`): the pages, theme at the bottom. */
export function AdminSidebar() {
  return (
    <aside className="sticky top-[46px] flex h-[calc(100dvh-46px)] w-[236px] shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-hairline bg-rail px-2.5 pb-4 pt-3">
      <AdminNav />
      <div className="mt-auto pt-2.5">
        <ThemeToggle />
      </div>
    </aside>
  );
}
