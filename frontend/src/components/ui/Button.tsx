import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Link, type LinkProps } from "react-router-dom";
import s from "./ui.module.css";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "accent" | "danger" | "dangerGhost";
export type ButtonSize = "sm" | "md" | "lg";

interface CommonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  iconOnly?: boolean;
  icon?: ReactNode;
}

function classes({ variant = "secondary", size = "md", block, iconOnly }: CommonProps, extra?: string) {
  return [s.button, s[variant], size !== "md" && s[size], block && s.block, iconOnly && s.iconOnly, extra]
    .filter(Boolean)
    .join(" ");
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, CommonProps {
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size, block, iconOnly, icon, loading, disabled, children, className, type = "button", ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      className={classes({ variant, size, block, iconOnly }, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <span className={s.spinnerInline} aria-hidden="true" /> : icon}
      {children}
    </button>
  );
});

export interface ButtonLinkProps extends LinkProps, CommonProps {}

export function ButtonLink({ variant, size, block, iconOnly, icon, children, className, ...rest }: ButtonLinkProps) {
  return (
    <Link className={classes({ variant, size, block, iconOnly }, className)} {...rest}>
      {icon}
      {children}
    </Link>
  );
}
