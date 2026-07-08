"use client";

import { useEffect, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { IconX } from "@tabler/icons-react";
import { IconButton } from "@/components/ui/icon-button";
import { cn } from "@/lib/utils/cn";

type ModalSize = "sm" | "md" | "lg" | "xl";

const sizeClasses: Record<ModalSize, string> = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-6xl",
};

export function Modal({
  children,
  className,
  description,
  onClose,
  open,
  title,
  size = "md",
}: {
  children: React.ReactNode;
  className?: string;
  description?: string;
  onClose: () => void;
  open: boolean;
  title: string;
  size?: ModalSize;
}) {
  const mounted = useSyncExternalStore(
    () => () => { },
    () => true,
    () => false,
  );

  useEffect(() => {
    if (!open) return;

    document.body.classList.add("modal-open");

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.classList.remove("modal-open");
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, open]);

  if (!open || !mounted) {
    return null;
  }

  return createPortal(
    <div
      aria-modal="true"
      className="fixed inset-0 z-modal flex items-center justify-center p-4 animate-fade-in"
      role="dialog"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Panel */}
      <div
        className={cn(
          "relative w-full rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_20px_60px_rgba(0,0,0,0.10)] animate-scale-in flex flex-col max-h-[calc(100vh-2rem)]",
          sizeClasses[size],
          className,
        )}
      >
        <div className="flex items-start justify-between gap-4 shrink-0">
          <div>
            <h2 className="headline-md text-slate-900">{title}</h2>
            {description ? (
              <p className="body-sm mt-1 text-slate-500">
                {description}
              </p>
            ) : null}
          </div>
          <IconButton aria-label="Close modal" onClick={onClose}>
            <IconX aria-hidden size={18} />
          </IconButton>
        </div>
        <div className="mt-5 overflow-y-auto pr-1 flex-1 min-h-0">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
