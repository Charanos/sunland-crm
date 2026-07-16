"use client";

import { useEffect } from "react";
import Image from "next/image";
import { IconX, IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { cn } from "@/lib/utils/cn";

interface PhotoLightboxProps {
  open: boolean;
  media: Array<{ url: string; alt?: string }>;
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}

export function PhotoLightbox({ open, media, index, onIndexChange, onClose }: PhotoLightboxProps) {
  const safeIndex = media.length > 0 ? Math.min(Math.max(index, 0), media.length - 1) : 0;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") onIndexChange((safeIndex - 1 + media.length) % media.length);
      if (e.key === "ArrowRight") onIndexChange((safeIndex + 1) % media.length);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, safeIndex, media.length, onIndexChange, onClose]);

  if (!open || media.length === 0) return null;
  const current = media[safeIndex];

  return (
    <div role="dialog" aria-label="Photo gallery" className="fixed inset-0 text-sm z-modal flex flex-col p-5 bg-[#0f132b]/95 animate-fade-in">
      <div className="flex items-center justify-between mb-3.5">
        <span className="mono-data text-white/75">{safeIndex + 1} / {media.length}</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close gallery"
          className="size-9 rounded-xl border border-white/20 flex items-center justify-center text-white hover:bg-white/10 transition-colors"
        >
          <IconX size={19} />
        </button>
      </div>
      <div className="flex-1 flex items-center gap-3.5 min-h-0">
        <button
          type="button"
          onClick={() => onIndexChange((safeIndex - 1 + media.length) % media.length)}
          aria-label="Previous photo"
          className="size-11 rounded-full border border-white/20 bg-white/5 flex items-center justify-center text-white hover:bg-white/15 transition-colors shrink-0"
        >
          <IconChevronLeft size={20} />
        </button>
        <div className="flex-1 h-full flex items-center justify-center min-w-0 relative">
          <Image
            src={current.url}
            alt={current.alt ?? "Property photo"}
            fill
            sizes="90vw"
            className="object-contain rounded-xl shadow-[0_24px_80px_rgba(0,0,0,0.5)]"
          />
        </div>
        <button
          type="button"
          onClick={() => onIndexChange((safeIndex + 1) % media.length)}
          aria-label="Next photo"
          className="size-11 rounded-full border border-white/20 bg-white/5 flex items-center justify-center text-white hover:bg-white/15 transition-colors shrink-0"
        >
          <IconChevronRight size={20} />
        </button>
      </div>
      {media.length > 1 && (
        <div className="flex justify-center gap-2 mt-3.5">
          {media.map((m, i) => (
            <button
              key={m.url + i}
              type="button"
              onClick={() => onIndexChange(i)}
              aria-label={`Show photo ${i + 1}`}
              className={cn(
                "relative w-14 h-10 rounded-lg overflow-hidden border-2 transition-opacity",
                i === safeIndex ? "border-[#f3df27] opacity-100" : "border-transparent opacity-60 hover:opacity-90"
              )}
            >
              <Image src={m.url} alt="" fill sizes="56px" className="object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
