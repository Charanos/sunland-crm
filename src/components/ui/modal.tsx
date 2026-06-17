"use client";

import { useEffect } from "react";
import { IconX } from "@tabler/icons-react";
import { IconButton } from "@/components/ui/icon-button";
import { cn } from "@/lib/utils/cn";

export function Modal({
  children,
  className,
  description,
  onClose,
  open,
  title,
}: {
  children: React.ReactNode;
  className?: string;
  description?: string;
  onClose: () => void;
  open: boolean;
  title: string;
}) {
  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm"
      role="dialog"
    >
      <div
        className={cn(
          "w-full max-w-lg rounded-2xl border border-[var(--outline)] bg-white p-5 shadow-2xl",
          className,
        )}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="headline-md">{title}</h2>
            {description ? (
              <p className="body-sm mt-1 text-[var(--on-surface-dim)]">
                {description}
              </p>
            ) : null}
          </div>
          <IconButton aria-label="Close modal" onClick={onClose}>
            <IconX aria-hidden size={18} />
          </IconButton>
        </div>
        <div className="mt-5">{children}</div>
      </div>
    </div>
  );
}
