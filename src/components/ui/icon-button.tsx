import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

type IconButtonSize = "sm" | "md" | "lg";

const sizes: Record<IconButtonSize, string> = {
  sm: "size-8",
  md: "size-10",
  lg: "size-12",
};

export function IconButton({
  className,
  size = "md",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  size?: IconButtonSize;
}) {
  return (
    <button
      className={cn(
        "focus-ring inline-flex items-center justify-center rounded-full border border-[var(--outline)] bg-white text-[var(--on-surface)] transition hover:bg-[var(--surface-muted)]",
        sizes[size],
        className,
      )}
      type={type}
      {...props}
    />
  );
}

