import type { InputHTMLAttributes } from "react";

/**
 * A native checkbox drawn as a toggle. Works inside plain form posts (`name`),
 * keeps keyboard focus (ring on the track), and needs no client JS.
 */
export function Switch(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    // A <label> so a click on the drawn track toggles the hidden checkbox.
    <label className="relative inline-flex h-[22px] w-10 shrink-0 cursor-pointer">
      <input type="checkbox" className="peer sr-only" {...props} />
      <span
        aria-hidden="true"
        className="absolute inset-0 cursor-pointer rounded-full border border-control bg-raised transition-colors peer-checked:border-brand peer-checked:bg-brand peer-focus-visible:[box-shadow:var(--ds-focus-ring)] peer-disabled:cursor-not-allowed peer-disabled:opacity-50"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-1 top-1 size-3.5 rounded-full bg-ink-muted transition-transform peer-checked:translate-x-[18px] peer-checked:bg-on-brand"
      />
    </label>
  );
}
