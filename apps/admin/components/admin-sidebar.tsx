import { ThemeToggle } from "@alevo/ui/theme-toggle";
import { AdminNav, OpenApp } from "./admin-nav";
import { Brand } from "./brand";

/** Left rail on desktop (the phone shell uses `MobileMenu`): brand on top, pages, theme and the app link at the bottom. */
export function AdminSidebar() {
  return (
    <aside className="sticky top-0 hidden h-dvh w-58 shrink-0 flex-col gap-6 border-r border-hairline px-4 py-6 md:flex">
      <div className="px-1">
        <Brand />
      </div>
      <AdminNav />
      <div className="mt-auto flex flex-col gap-4 px-1">
        <ThemeToggle />
        <OpenApp className="border-t border-hairline pt-4" />
      </div>
    </aside>
  );
}
