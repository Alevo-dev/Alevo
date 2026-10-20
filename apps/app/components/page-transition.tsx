import { ViewTransition } from "react";

/**
 * Route enter/exit animation. Used by the `template.tsx` files (a template
 * remounts on navigation; a layout does not), so enter/exit fire on each
 * route change: untyped navigations fade + rise; links tagged
 * `transitionTypes={["nav-forward"]}` / `["nav-back"]` slide. CSS: globals.css
 * under "View transitions".
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <ViewTransition
      enter={{ "nav-forward": "nav-forward", "nav-back": "nav-back", default: "page-enter" }}
      exit={{ "nav-forward": "nav-forward", "nav-back": "nav-back", default: "page-exit" }}
      default="none"
    >
      <div className="min-w-0">{children}</div>
    </ViewTransition>
  );
}
