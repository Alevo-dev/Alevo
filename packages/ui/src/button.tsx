import type { ComponentProps } from "react";
import { Loader2 } from "lucide-react";
import { cx } from "./cx";

export type ButtonVariant = "primary" | "accent" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

const BASE =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-sm font-medium " +
  "transition-colors disabled:cursor-not-allowed disabled:opacity-50";

const VARIANT: Record<ButtonVariant, string> = {
  // Brand fills carry on-brand navy text, never white (design system).
  primary: "bg-brand font-semibold text-on-brand hover:bg-brand-sky",
  accent: "bg-violet font-semibold text-on-brand hover:bg-violet-light",
  secondary: "border border-control bg-surface text-ink hover:bg-raised",
  ghost: "border border-control bg-transparent text-ink hover:bg-raised",
  danger: "border border-hairline bg-transparent text-danger hover:bg-raised",
};

const SIZE: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-label",
  md: "h-10 px-4 text-sm",
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
