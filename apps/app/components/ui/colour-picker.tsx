"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/field";
import { cx } from "@/lib/cx";
import { hexToHsv, hsvToHex, normaliseHex, type Hsv } from "@/lib/colour";

const START = "#2e9be6";
const clamp = (n: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, n));
const THUMB =
  "pointer-events-none absolute size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,.35)]";
const FOCUS = "outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

/** The picker surface: a saturation / brightness area and a hue slider. Pointer, touch and arrow keys (Shift = bigger steps). */
function Panel({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  // The last position dragged to. Greys and black have no hue of their own, so it is kept for them.
  const [memo, setMemo] = useState<Hsv>(() => hexToHsv(normaliseHex(value) ?? START));
  const typed = normaliseHex(value);
  let hsv = memo;
  if (typed && typed !== hsvToHex(memo)) {
    const read = hexToHsv(typed);
    hsv = read.s === 0 || read.v === 0 ? { ...read, h: memo.h } : read;
  }

  function set(next: Hsv) {
    setMemo(next);
    onChange(hsvToHex(next));
  }
  // Press to jump, drag to follow (captured, so it keeps tracking outside the box).
  const at = (e: PointerEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: clamp((e.clientX - r.left) / r.width), y: clamp((e.clientY - r.top) / r.height) };
  };
  const area = {
    onPointerDown(e: PointerEvent<HTMLDivElement>) {
      e.currentTarget.setPointerCapture(e.pointerId);
      const { x, y } = at(e);
      set({ h: hsv.h, s: x, v: 1 - y });
    },
    onPointerMove(e: PointerEvent<HTMLDivElement>) {
      if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
      const { x, y } = at(e);
      set({ h: hsv.h, s: x, v: 1 - y });
    },
    onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
      const step = e.shiftKey ? 0.1 : 0.01;
      const dx = e.key === "ArrowRight" ? step : e.key === "ArrowLeft" ? -step : 0;
      const dy = e.key === "ArrowUp" ? step : e.key === "ArrowDown" ? -step : 0;
      if (!dx && !dy) return;
      e.preventDefault();
      set({ h: hsv.h, s: clamp(hsv.s + dx), v: clamp(hsv.v + dy) });
    },
  };
  const hue = {
    onPointerDown(e: PointerEvent<HTMLDivElement>) {
      e.currentTarget.setPointerCapture(e.pointerId);
      set({ ...hsv, h: at(e).x * 359 });
    },
    onPointerMove(e: PointerEvent<HTMLDivElement>) {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) set({ ...hsv, h: at(e).x * 359 });
    },
    onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
      const step = e.shiftKey ? 10 : 1;
      const d = e.key === "ArrowRight" || e.key === "ArrowUp" ? step : e.key === "ArrowLeft" || e.key === "ArrowDown" ? -step : 0;
      if (!d) return;
      e.preventDefault();
      set({ ...hsv, h: clamp(hsv.h + d, 0, 359) });
    },
  };

  return (
    <div className="space-y-3">
      <div
        role="slider"
        tabIndex={0}
        aria-label="Saturation and brightness"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(hsv.s * 100)}
        aria-valuetext={`Saturation ${Math.round(hsv.s * 100)}%, brightness ${Math.round(hsv.v * 100)}%`}
        {...area}
        style={{ background: `linear-gradient(to top,#000,transparent),linear-gradient(to right,#fff,transparent),${hsvToHex({ h: hsv.h, s: 1, v: 1 })}`, touchAction: "none" }}
        className={cx("relative h-36 w-full cursor-crosshair rounded-md border border-hairline", FOCUS)}
      >
        <span className={THUMB} style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, background: hsvToHex(hsv) }} aria-hidden="true" />
      </div>
      <div
        role="slider"
        tabIndex={0}
        aria-label="Hue"
        aria-valuemin={0}
        aria-valuemax={359}
        aria-valuenow={Math.round(hsv.h)}
        {...hue}
        style={{ background: "linear-gradient(to right,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)", touchAction: "none" }}
        className={cx("relative h-4 w-full cursor-pointer rounded-full border border-hairline", FOCUS)}
      >
        <span className={cx(THUMB, "top-1/2")} style={{ left: `${(hsv.h / 359) * 100}%`, background: hsvToHex({ h: hsv.h, s: 1, v: 1 }) }} aria-hidden="true" />
      </div>
    </div>
  );
}

/**
 * One colour setting as a row: a label, a swatch showing the colour and its hex beside it. Click the
 * swatch for the picker (a popover; Esc, Done or a click elsewhere closes it, and Esc does not close the
 * dialog behind it). The hex field is in the picker, beside a small Use default, with a full-width primary Done below: it takes #rrggbb or #rgb, with or without
 * the #, and tidies when you leave it. Blank means "use the default" (the picker has a Use default button): the swatch then shows `emptyHex` with a dashed edge.
 */
export function ColourField({
  id,
  name,
  label,
  hint,
  value,
  onChange,
  emptyHex,
  error,
  disabled,
}: {
  id: string;
  name: string;
  label: string;
  hint?: string;
  value: string;
  onChange: (hex: string) => void;
  /** The colour that applies while this is blank, drawn in the swatch. */
  emptyHex: string;
  error?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const swatchRef = useRef<HTMLButtonElement>(null);
  const typed = normaliseHex(value);

  useEffect(() => {
    if (!open) return;
    wrapRef.current?.querySelector<HTMLElement>("[role=slider]")?.focus();
    const away = (e: globalThis.PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);

  return (
    <div
      ref={wrapRef}
      className="relative space-y-2"
      onKeyDown={(e) => {
        if (open && e.key === "Escape") {
          e.stopPropagation(); // close the picker, not the dialog it sits in
          setOpen(false);
          swatchRef.current?.focus();
        }
      }}
    >
      <Label htmlFor={id}>{label}</Label>
      {hint && <p className="text-label text-ink-muted">{hint}</p>}
      <div className="flex items-center gap-3">
        <button
          ref={swatchRef}
          id={id}
          type="button"
          disabled={disabled}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={`${label}: open the colour picker`}
          onClick={() => setOpen((o) => !o)}
          style={{ background: typed ?? emptyHex }}
          className={cx(
            "size-11 shrink-0 rounded-md border-2 transition-shadow disabled:cursor-not-allowed disabled:opacity-50",
            typed ? "border-hairline" : "border-dashed border-ink-muted",
            FOCUS,
          )}
        />
        {/* The value posted with the form; the field you type in lives in the picker, beside Done. */}
        <input type="hidden" name={name} value={value} />
        <span className={cx("font-mono text-sm", typed ? "text-ink" : "text-ink-muted")}>{typed ?? "Default"}</span>
      </div>
      <FieldError>{error}</FieldError>

      {open && (
        <div
          role="dialog"
          aria-label={`${label} picker`}
          className="absolute left-0 top-full z-20 mt-2 w-80 max-w-[calc(100vw-4rem)] space-y-3 rounded-md border border-hairline bg-surface p-3 shadow-float"
        >
          <Panel value={value} onChange={onChange} />
          <div className="flex items-center gap-2">
            <Input
              id={`${id}-hex`}
              aria-label={`${label} hex code`}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onBlur={() => {
                if (typed && typed !== value) onChange(typed);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault(); // Enter confirms the colour, it does not submit the form
                  setOpen(false);
                  swatchRef.current?.focus();
                }
              }}
              invalid={!!error}
              placeholder="#rrggbb"
              maxLength={7}
              spellCheck={false}
              autoComplete="off"
              className="min-w-0 flex-1 font-mono"
            />
            {value.trim() && (
              <Button type="button" size="sm" variant="ghost" className="shrink-0" onClick={() => onChange("")}>
                Use default
              </Button>
            )}
          </div>
          <Button type="button" variant="primary" className="w-full" onClick={() => { setOpen(false); swatchRef.current?.focus(); }}>
            Done
          </Button>
        </div>
      )}
    </div>
  );
}
