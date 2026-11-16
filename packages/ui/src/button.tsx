import type { ComponentProps } from "react";
import { Loader2 } from "lucide-react";
import { cx } from "./cx";

export type ButtonVariant = "primary" | "accent" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

const BASE =
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-xs text-[13.5px] font-[550] " +
  "transition-[color,background-color,border-color,transform] duration-150 ease-out active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100 disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100";

const VARIANT: Record<ButtonVariant, string> = {
  // Brand fills carry on-brand navy text, never white (design system).
  primary: "border border-brand bg-brand text-on-brand hover:border-brand-sky hover:bg-brand-sky",
  accent: "border border-violet bg-violet text-on-brand hover:border-violet-light hover:bg-violet-light",
  secondary: "border border-control bg-surface text-ink hover:bg-raised",
  ghost: "border border-control bg-transparent text-ink hover:bg-raised",
  danger: "border border-danger/70 bg-transparent text-danger hover:bg-danger/10",
};

const SIZE: Record<ButtonSize, string> = {
  sm: "h-8 px-3",
  md: "h-9 px-3.5",
};

/** Class string for button-looking links (`<Link>` / `<a>`). */
export function buttonClass(
  variant: ButtonVariant = "secondary",
  size: ButtonSize = "md",
  className?: string,
): string {
  return cx(BASE, VARIANT[variant], SIZE[size], className);
}

/** The in-button spinner, also usable in button-styled labels/links. */
export function Spinner({ size = "md" }: { size?: ButtonSize }) {
  return <Loader2 className={cx("shrink-0 animate-spin", size === "sm" ? "size-3.5" : "size-4")} aria-hidden="true" />;
}

// `ComponentProps` (not `ButtonHTMLAttributes`) so `ref` passes through (React 19).
type Props = ComponentProps<"button"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** In flight: shows a spinner, disables the button and sets aria-busy. */
  loading?: boolean;
};

export function Button({
  variant = "secondary",
  size = "md",
  loading = false,
  disabled,
  className,
  type = "button",
  children,
  ...rest
}: Props) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClass(variant, size, className)}
      {...rest}
    >
      {loading && <Spinner size={size} />}
      {children}
    </button>
  );
}
