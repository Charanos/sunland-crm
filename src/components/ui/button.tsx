import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

const variants: Record<ButtonVariant, string> = {
  primary:
    "border-transparent bg-[var(--primary)] text-[var(--on-primary)] hover:bg-[var(--primary-container)]",
  secondary:
    "border-[var(--outline)] bg-white text-[var(--on-surface)] hover:bg-[var(--surface-muted)]",
  ghost:
    "border-transparent bg-transparent text-[var(--on-surface-dim)] hover:bg-black/[0.04] hover:text-[var(--on-surface)]",
  danger:
    "border-transparent bg-[var(--error)] text-white hover:bg-[#bd3232]",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-sm  gap-1.5",
  md: "h-10 px-4 text-sm  gap-2",
  lg: "h-12 px-6 text-base  gap-2.5",
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return (
    <button
      className={cn(
        "focus-ring inline-flex items-center justify-center rounded-lg border font-medium transition",
        "disabled:opacity-60",
        variants[variant],
        sizes[size],
        className,
      )}
      type={type}
      {...props}
    />
  );
}

