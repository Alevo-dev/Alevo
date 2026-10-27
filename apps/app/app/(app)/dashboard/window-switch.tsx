import { WindowSwitch as Switch } from "@alevo/ui/window-switch";
import { WINDOWS, type Window } from "@/lib/dashboard/window";

/**
 * The one time-window control for the page: 7 / 30 / 90 days as links that set
 * `?window=`, so the server page re-queries and the choice survives a refresh.
 * Scopes every chart and figure below it except the usage meter (billing month).
 */
export function WindowSwitch({ value }: { value: Window }) {
  return <Switch value={value} windows={WINDOWS} />;
}
