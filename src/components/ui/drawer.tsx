"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { IconX } from "@tabler/icons-react";
import { IconButton } from "@/components/ui/icon-button";
import { cn } from "@/lib/utils/cn";

export function Drawer({
  children,
  footer,
  onClose,
  open,
  side = "right",
  title,
  width = "30rem",
}: {
  children: React.ReactNode;
  footer?: React.ReactNode;
  onClose: () => void;
  open: boolean;
  side?: "left" | "right";
  title: string;
  width?: string;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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
    <div className="fixed inset-0 z-[100] animate-fade-in">
      {/* Backdrop */}
      <button
        aria-label="Close drawer backdrop"
        className="absolute inset-0 size-full cursor-default bg-black/30 backdrop-blur-[2px]"
        onClick={onClose}
        type="button"
      />
      {/* Panel */}
      <aside
        className={cn(
          "absolute top-0 h-full overflow-y-auto bg-white shadow-[0_0_60px_rgba(0,0,0,0.10)] flex flex-col",
          side === "left"
            ? "left-0 animate-slide-in-right"
            : "right-0 animate-slide-in-right",
        )}
        style={{ width: `min(${width}, 100vw)` }}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-slate-100 bg-white px-5 py-4">
          <h2 className="headline-md text-slate-900">{title}</h2>
          <IconButton aria-label="Close drawer" onClick={onClose}>
            <IconX aria-hidden size={18} />
          </IconButton>
        </div>
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
          {children}
        </div>
        {/* Footer */}
        {footer ? (
          <div className="sticky bottom-0 border-t border-slate-100 bg-white px-5 py-3.5">
            {footer}
          </div>
        ) : null}
      </aside>
    </div>,
    document.body,
  );
}
