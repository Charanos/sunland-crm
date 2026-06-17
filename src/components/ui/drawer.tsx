"use client";

import { useEffect } from "react";
import { IconX } from "@tabler/icons-react";
import { IconButton } from "@/components/ui/icon-button";
import { cn } from "@/lib/utils/cn";

export function Drawer({
  children,
  onClose,
  open,
  side = "right",
  title,
}: {
  children: React.ReactNode;
  onClose: () => void;
  open: boolean;
  side?: "left" | "right";
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
    <div className="fixed inset-0 z-50 bg-black/35 backdrop-blur-sm">
      <button
        aria-label="Close drawer backdrop"
        className="absolute inset-0 size-full cursor-default"
        onClick={onClose}
        type="button"
      />
      <aside
        className={cn(
          "absolute top-0 h-full w-[min(30rem,100vw)] overflow-y-auto bg-white p-5 shadow-2xl",
          side === "left" ? "left-0" : "right-0",
        )}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-4 bg-white pb-4">
          <h2 className="headline-md">{title}</h2>
          <IconButton aria-label="Close drawer" onClick={onClose}>
            <IconX aria-hidden size={18} />
          </IconButton>
        </div>
        {children}
      </aside>
    </div>
  );
}
