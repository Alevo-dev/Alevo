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

/** A labelled toggle row: title + hint on the left, switch on the right. */
export function SwitchRow({
  id,
  label,
  hint,
  ...input
}: InputHTMLAttributes<HTMLInputElement> & { id: string; label: string; hint?: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-4">
      <label htmlFor={id} className="cursor-pointer">
        <span className="block text-sm font-semibold text-ink">{label}</span>
        {hint && <span className="mt-1 block text-label text-ink-muted">{hint}</span>}
      </label>
      <Switch id={id} {...input} />
    </div>
  );
}
