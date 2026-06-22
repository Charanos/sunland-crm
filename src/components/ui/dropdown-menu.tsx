"use client";

import { useEffect, useRef, useState } from "react";
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
      {open ? (
        <div
          className={cn(
            "absolute top-12 z-50 w-64 rounded-xl border border-[var(--outline)] bg-white p-2 shadow-2xl",
            align === "right" ? "right-0" : "left-0",
          )}
          role="menu"
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

export function DropdownItem({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      className="focus-ring flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-sm  text-[var(--on-surface)] hover:bg-[var(--surface-muted)]"
      onClick={onClick}
      role="menuitem"
      type="button"
    >
      {children}
    </button>
  );
}
