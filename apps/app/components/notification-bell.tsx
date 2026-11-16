import { Bell } from "lucide-react";
import { IconButton } from "@/components/ui/icon-button";

/**
 * The top bar's notifications bell, between Support and the avatar. The count is a placeholder (always 0)
 * until the notifications feature lands: then `count` comes from the server and the button opens the list.
 */
export function NotificationBell({ count = 0 }: { count?: number }) {
  return (
    <IconButton aria-label={`Notifications, ${count} unread`} title="Notifications" className="relative">
      <Bell className="size-[18px]" strokeWidth={1.75} aria-hidden="true" />
      <span
        aria-hidden="true"
        className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-brand px-1 font-mono text-[10px] font-semibold leading-none text-on-brand"
      >
        {count > 99 ? "99+" : count}
      </span>
    </IconButton>
  );
}
