import { WindowSwitch as Switch } from "@alevo/ui/window-switch";
import { WINDOW_COOKIE } from "@/lib/dashboard/window-cookie";
import { WINDOWS, type Window } from "@/lib/dashboard/window";

/**
 * The one time-window control for the page: Today / 7 / 30 / 90 days, saved in one cookie
 * so the same window applies on every page until it is changed.
 * Scopes every chart and figure below it except the usage meter (billing month).
 */
export function WindowSwitch({ value }: { value: Window }) {
  return <Switch value={value} windows={WINDOWS} persistKey={WINDOW_COOKIE} />;
}
