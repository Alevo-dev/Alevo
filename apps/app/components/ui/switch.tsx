import type { InputHTMLAttributes } from "react";

/**
 * A native checkbox drawn as a toggle (30x17 track, 13px knob). Works inside
 * plain form posts (`name`), keeps keyboard focus (ring on the track), and
 * needs no client JS. On = brand track with a navy knob.
 */
export function Switch(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    // A <label> so a click on the drawn track toggles the hidden checkbox.
    <label className="relative inline-flex h-[17px] w-[30px] shrink-0 cursor-pointer">
      <input type="checkbox" className="peer sr-only" {...props} />
      <span
        aria-hidden="true"
        className="absolute inset-0 cursor-pointer rounded-full bg-control transition-colors duration-150 ease-out motion-reduce:transition-none peer-checked:bg-brand peer-focus-visible:[box-shadow:var(--ds-focus-ring)] peer-disabled:cursor-not-allowed peer-disabled:opacity-50"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-0.5 top-0.5 size-[13px] rounded-full bg-canvas transition-transform duration-150 ease-out motion-reduce:transition-none peer-checked:translate-x-[13px] peer-checked:bg-on-brand"
      />
    </label>
  );
}
