"use client";

import { useCallback, useEffect, useId, useRef, useState, type ComponentType, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Check } from "lucide-react";
import { cx } from "@/lib/cx";

export type MenuItem = {
  key: string;
  label: ReactNode;
  icon?: ComponentType<{ className?: string; strokeWidth?: number; "aria-hidden"?: boolean }>;
  /** Rich slot before the label (an avatar tile); wins over `icon`. */
  leading?: ReactNode;
  onSelect: () => void;
  /** Shows a check on the right (the active workspace, the current choice). */
  selected?: boolean;
  danger?: boolean;
  disabled?: boolean;
};

type Props = {
  /** Trigger content; the Menu renders and wires the button itself. */
  button: ReactNode;
  buttonClassName?: string;
  "aria-label": string;
  /** Non-interactive block pinned above the items (identity, context). */
  header?: ReactNode;
  /** Items in groups; groups are divided by hairline rules. */
  groups: MenuItem[][];
  /** Which trigger edge the menu hugs. */
  align?: "start" | "end";
  /** Row height: md = compact actions, lg = rows with avatars (Clerk-sized). */
  size?: "md" | "lg";
  menuClassName?: string;
  disabled?: boolean;
};

type Pos = { top: number; left: number; width: number; up: boolean };

/**
 * The app's action menu: a trigger + a portal menu on our own surface, never
 * the browser's. Same interaction grammar as Select (arrows, Home/End, Enter,
 * Escape, outside click), but items run actions instead of picking a value.
 */
export function Menu({
  button,
  buttonClassName,
  header,
  groups: allGroups,
  align = "start",
  size = "md",
  menuClassName,
  disabled,
  ...aria
}: Props) {
  const menuId = `${useId()}-menu`;
  const groups = allGroups.filter((g) => g.length > 0);
  const items = groups.flat();
  const itemH = size === "lg" ? 44 : 36;
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [pos, setPos] = useState<Pos | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const place = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    // Estimate: items + group rules + padding (+ a header block when present).
    const menuH = items.length * itemH + (groups.length - 1) * 9 + 8 + (header ? 64 : 0);
    const up = window.innerHeight - r.bottom < menuH + 8 && r.top > menuH + 8;
    setPos({
      top: up ? r.top - 4 : r.bottom + 4,
      left: align === "end" ? r.right : r.left,
      width: r.width,
      up,
    });
  }, [items.length, groups.length, header, align, itemH]);

  const openMenu = () => {
    if (disabled) return;
    place();
    setActive(-1);
    setOpen(true);
  };
  const close = useCallback(() => {
    setOpen(false);
    setActive(-1);
  }, []);
  const run = (item: MenuItem) => {
    if (item.disabled) return;
    close();
    triggerRef.current?.focus();
    item.onSelect();
  };
  const move = (from: number, dir: 1 | -1) => {
    // Next enabled item in that direction, no wrap.
    for (let i = from + dir; i >= 0 && i < items.length; i += dir) {
      if (!items[i]!.disabled) return i;
    }
    return from;
  };

  // Outside click closes; scroll/resize re-anchors the portal menu.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!triggerRef.current?.contains(t) && !menuRef.current?.contains(t)) close();
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, place, close]);

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        openMenu();
        setActive(move(-1, 1));
      }
      return;
    }
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActive((i) => move(i, 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActive((i) => (i < 0 ? move(items.length, -1) : move(i, -1)));
        break;
      case "Home":
        e.preventDefault();
        setActive(move(-1, 1));
        break;
      case "End":
        e.preventDefault();
        setActive(move(items.length, -1));
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        if (items[active]) run(items[active]);
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

  // Flat index of each group's first item, for ids + the active highlight.
  const offsets = groups.map(((sum) => (g: MenuItem[]) => {
    const at = sum;
    sum += g.length;
    return at;
  })(0));

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-activedescendant={open && active >= 0 ? `${menuId}-${active}` : undefined}
        disabled={disabled}
        onClick={() => (open ? close() : openMenu())}
        onKeyDown={onKeyDown}
        className={cx("disabled:cursor-not-allowed disabled:opacity-50", buttonClassName)}
        {...aria}
      >
        {button}
      </button>

      {open &&
        pos &&
        createPortal(
          <div
            ref={menuRef}
            id={menuId}
            role="menu"
            aria-label={aria["aria-label"]}
            style={{
              top: pos.top,
              left: pos.left,
              minWidth: Math.max(pos.width, 208),
              transform: `${align === "end" ? "translateX(-100%)" : ""} ${pos.up ? "translateY(-100%)" : ""}`.trim() || undefined,
            }}
            className={cx("fixed z-50 rounded-md border border-hairline bg-raised p-1 shadow-float", menuClassName)}
          >
            {header && <div className="border-b border-hairline px-3 pb-2.5 pt-2">{header}</div>}
            {groups.map((group, g) => (
              <div key={g} className={g > 0 ? "mt-1 border-t border-hairline pt-1" : header ? "pt-1" : undefined}>
                {group.map((item, inGroup) => {
                  const i = offsets[g]! + inGroup;
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.key}
                      id={`${menuId}-${i}`}
                      role="menuitem"
                      aria-disabled={item.disabled || undefined}
                      onMouseEnter={() => setActive(i)}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => run(items[i]!)}
                      className={cx(
                        "flex items-center gap-2.5 rounded-sm px-3 text-sm",
                        size === "lg" ? "h-11" : "h-9",
                        item.disabled ? "cursor-default opacity-50" : "cursor-pointer",
                        item.danger ? "text-danger" : "text-ink",
                        i === active && !item.disabled && "bg-brand-soft",
                      )}
                    >
                      {item.leading ??
                        (Icon && (
                          <Icon
                            className={cx("size-4 shrink-0", item.danger ? "text-danger" : "text-ink-muted")}
                            strokeWidth={1.75}
                            aria-hidden
                          />
                        ))}
                      <span className="min-w-0 flex-1 truncate text-left">{item.label}</span>
                      {item.selected && <Check className="size-4 shrink-0 text-brand" strokeWidth={2} aria-hidden="true" />}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
