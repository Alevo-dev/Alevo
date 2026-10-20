"use client";

import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
import { cx } from "@/lib/cx";
import { controlClass } from "./field";

export type SelectOption = { value: string; label: string };

type Props = {
  id?: string;
  /** Posted with the surrounding form (a hidden input carries the value). */
  name?: string;
  options: readonly SelectOption[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  invalid?: boolean;
  /** Natural width (table cells, inline rows) instead of full width. */
  inline?: boolean;
  disabled?: boolean;
  size?: "sm" | "md";
  className?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
};

type Pos = { top: number; left: number; width: number; up: boolean };

const OPTION_H = 36;
const MENU_MAX = 280;

/**
 * The app's dropdown: a combobox trigger + a listbox menu drawn on our own
 * surface, never the browser's. Works in plain server-action forms through a
 * hidden input, and fully by keyboard (arrows, Home/End, Enter, Escape).
 */
export function Select({
  id,
  name,
  options,
  value,
  defaultValue,
  onChange,
  placeholder = "Select…",
  invalid,
  inline,
  disabled,
  size = "md",
  className,
  ...aria
}: Props) {
  const listId = `${useId()}-listbox`;
  const [internal, setInternal] = useState(defaultValue ?? "");
  const current = value ?? internal;
  const selected = options.find((o) => o.value === current);

  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [pos, setPos] = useState<Pos | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const place = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const menuH = Math.min(options.length * OPTION_H + 8, MENU_MAX);
    const up = window.innerHeight - r.bottom < menuH + 8 && r.top > menuH + 8;
    setPos({ top: up ? r.top - 4 : r.bottom + 4, left: r.left, width: r.width, up });
  }, [options.length]);

  const openMenu = () => {
    if (disabled) return;
    place();
    setActive(Math.max(0, options.findIndex((o) => o.value === current)));
    setOpen(true);
  };
  const close = () => {
    setOpen(false);
    setActive(-1);
  };
  const choose = (next: string) => {
    if (value === undefined) setInternal(next);
    onChange?.(next);
    close();
    triggerRef.current?.focus();
  };

  // Outside click closes; scroll/resize re-anchors the portal menu.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!triggerRef.current?.contains(t) && !listRef.current?.contains(t)) {
        setOpen(false);
        setActive(-1);
      }
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, place]);

  // Keep the active option in view while arrowing.
  useEffect(() => {
    if (!open || active < 0) return;
    listRef.current?.children[active]?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        openMenu();
      }
      return;
    }
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActive((i) => Math.min(i + 1, options.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActive((i) => Math.max(i - 1, 0));
        break;
      case "Home":
        e.preventDefault();
        setActive(0);
        break;
      case "End":
        e.preventDefault();
        setActive(options.length - 1);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        if (options[active]) choose(options[active].value);
        break;
      case "Escape":
        e.preventDefault();
        close();
        break;
      case "Tab":
        close();
        break;
    }
  };

  const activeId = open && active >= 0 ? `${listId}-${active}` : undefined;

  return (
    <>
      {name && <input type="hidden" name={name} value={current} />}
      <button
        ref={triggerRef}
        type="button"
        id={id}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={activeId}
        aria-invalid={invalid || undefined}
        disabled={disabled}
        onClick={() => (open ? close() : openMenu())}
        onKeyDown={onKeyDown}
        className={controlClass(
          invalid,
          cx(
            "flex items-center justify-between gap-2 text-left",
            size === "sm" ? "h-8 py-0 text-label" : "h-10 py-0",
            open && !invalid && "border-brand",
            className,
          ),
          inline,
        )}
        {...aria}
      >
        <span className={cx("truncate", !selected && "text-ink-muted")}>{selected?.label ?? placeholder}</span>
        <ChevronDown
          className={cx("size-4 shrink-0 text-ink-muted transition-transform", open && "rotate-180")}
          strokeWidth={1.75}
          aria-hidden="true"
        />
      </button>

      {open &&
        pos &&
        createPortal(
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            aria-label={aria["aria-label"]}
            style={{
              top: pos.top,
              left: pos.left,
              minWidth: pos.width,
              maxHeight: MENU_MAX,
              transform: pos.up ? "translateY(-100%)" : undefined,
            }}
            className="fixed z-50 overflow-y-auto rounded-md border border-hairline bg-raised p-1 shadow-float"
          >
            {options.map((o, i) => {
              const isSelected = o.value === current;
              return (
                <li
                  key={o.value}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={isSelected}
                  onMouseEnter={() => setActive(i)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => choose(o.value)}
                  className={cx(
                    "flex h-9 cursor-pointer items-center justify-between gap-3 whitespace-nowrap rounded-sm px-3 text-sm text-ink",
                    i === active && "bg-brand-soft",
                    isSelected && "font-medium",
                  )}
                >
                  {o.label}
                  {isSelected && <Check className="size-4 text-brand" strokeWidth={2} aria-hidden="true" />}
                </li>
              );
            })}
          </ul>,
          document.body,
        )}
    </>
  );
}
