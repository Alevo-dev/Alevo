// import { ViewTransition } from "react";

/**
 * Route enter/exit animation. Used by the `template.tsx` files (a template
 * remounts on navigation; a layout does not), so enter/exit fire on each
 * route change: untyped navigations fade + rise; links tagged
 * `transitionTypes={["nav-forward"]}` / `["nav-back"]` slide. Timings live in
 * globals.css under "View transitions" (~120ms, 64px slides).
 *
 * DISABLED (2026-10-20): navigation felt slower with it on. The wrapper passes
 * children straight through. To re-enable, swap the return for the commented
 * block below and restore the import.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  return <div className="min-w-0">{children}</div>;
  // return (
  //   <ViewTransition
  //     enter={{ "nav-forward": "nav-forward", "nav-back": "nav-back", default: "page-enter" }}
  //     exit={{ "nav-forward": "nav-forward", "nav-back": "nav-back", default: "page-exit" }}
  //     default="none"
  //   >
  //     <div className="min-w-0">{children}</div>
  //   </ViewTransition>
  // );
}
