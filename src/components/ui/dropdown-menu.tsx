"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
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
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left?: number; right?: number }>({ top: 0 });

  // Recompute position every time the menu opens or the window scrolls/resizes
  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setCoords({
      top: rect.bottom + 6,
      // align right: anchor the menu's right edge to the trigger's right edge
      // align left:  anchor the menu's left edge to the trigger's left edge
      ...(align === "right"
        ? { right: window.innerWidth - rect.right }
        : { left: rect.left }),
    });
  }, [open, align]);

  // Re-position on scroll / resize while the menu is open
  useEffect(() => {
    if (!open) return;
    const reposition = () => {
      if (!triggerRef.current) return;
      const rect = triggerRef.current.getBoundingClientRect();
      setCoords({
        top: rect.bottom + 6,
        ...(align === "right"
          ? { right: window.innerWidth - rect.right }
          : { left: rect.left }),
      });
    };
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [open, align]);

  // Close on outside pointer-down
  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !menuRef.current?.contains(target)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <>
      <button
        ref={triggerRef}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={label}
        className="focus-ring inline-flex items-center gap-2 rounded-full"
        onClick={() => setOpen((c) => !c)}
        type="button"
      >
        {trigger ?? (
          <span className="inline-flex h-10 items-center gap-2 rounded-full border border-[var(--outline)] bg-white px-4 text-sm">
            {label}
            <IconChevronDown aria-hidden size={15} />
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            ref={menuRef}
            initial={{ opacity: 0, y: 6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.97 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            style={{
              position: "fixed",
              top: coords.top,
              ...(coords.right !== undefined ? { right: coords.right } : { left: coords.left }),
            }}
            className="z-[200] w-56 rounded-xl border border-[var(--outline)] bg-white p-1.5 shadow-[0_16px_40px_rgba(0,0,0,0.14)]"
            role="menu"
            onClick={() => setOpen(false)}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </>
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
