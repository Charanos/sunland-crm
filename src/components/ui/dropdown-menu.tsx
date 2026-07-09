"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { IconChevronDown } from "@tabler/icons-react";
import { cn } from "@/lib/utils/cn";

export function DropdownMenu({
  align = "right",
  children,
  label,
  trigger,
}: {
  align?: "left" | "right";
  children: React.ReactNode;
  label: string;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!ref.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={label}
        className="focus-ring inline-flex items-center gap-2 rounded-full"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        {trigger ?? (
          <span className="inline-flex h-10 items-center gap-2 rounded-full border border-[var(--outline)] bg-white px-4 text-sm ">
            {label}
            <IconChevronDown aria-hidden size={15} />
          </span>
        )}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.97 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className={cn(
              "absolute top-12 z-50 w-64 rounded-xl border border-[var(--outline)] bg-white p-1.5 shadow-[0_16px_40px_rgba(0,0,0,0.12)]",
              align === "right" ? "right-0" : "left-0",
            )}
            role="menu"
            onClick={() => setOpen(false)}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function DropdownItem({
  children,
  icon: Icon,
  onClick,
  variant = "default",
}: {
  children: React.ReactNode;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  onClick?: () => void;
  variant?: "default" | "danger";
}) {
  return (
    <button
      className={cn(
        "focus-ring flex min-h-10 w-full items-center gap-2.5 rounded-lg px-3 text-left text-sm transition-colors",
        variant === "danger"
          ? "text-rose-600 hover:bg-rose-50"
          : "text-[var(--on-surface)] hover:bg-[var(--surface-muted)]",
      )}
      onClick={onClick}
      role="menuitem"
      type="button"
    >
      {Icon && <Icon size={15} className={variant === "danger" ? "text-rose-500 shrink-0" : "text-slate-400 shrink-0"} />}
      {children}
    </button>
  );
}
