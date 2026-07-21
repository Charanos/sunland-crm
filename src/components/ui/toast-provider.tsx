"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import {
  IconAlertTriangle,
  IconCheck,
  IconInfoCircle,
  IconX,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils/cn";

type ToastTone = "success" | "warning" | "error" | "info";
type Toast = {
  id: string;
  tone: ToastTone;
  title: string;
  body?: string;
  duration: number;
};

type ToastContextValue = {
  pushToast: (toast: Omit<Toast, "id" | "duration"> & { duration?: number }) => void;
  dismissToast: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const toneStyles: Record<ToastTone, { icon: string; iconBg: string; artwork: string }> = {
  success: {
    icon: "text-emerald-500",
    iconBg: "bg-emerald-50 border-emerald-100/50",
    artwork: "text-emerald-500",
  },
  warning: {
    icon: "text-amber-500",
    iconBg: "bg-amber-50 border-amber-100/50",
    artwork: "text-amber-500",
  },
  error: {
    icon: "text-rose-500",
    iconBg: "bg-rose-50 border-rose-100/50",
    artwork: "text-rose-500",
  },
  info: {
    icon: "text-blue-500",
    iconBg: "bg-blue-50 border-blue-100/50",
    artwork: "text-blue-500",
  },
};

const toneIcons = {
  success: IconCheck,
  warning: IconAlertTriangle,
  error: IconX,
  info: IconInfoCircle,
};

const DEFAULT_DURATIONS: Record<ToastTone, number> = {
  success: 4000,
  warning: 5000,
  error: 6000,
  info: 4000,
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [exiting, setExiting] = useState<Set<string>>(new Set());

  const dismissToast = useCallback((id: string) => {
    setExiting((prev) => new Set(prev).add(id));
    setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id));
      setExiting((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 300);
  }, []);

  const value = useMemo<ToastContextValue>(
    () => ({
      dismissToast,
      pushToast(toast) {
        const id = crypto.randomUUID();
        const duration = toast.duration ?? DEFAULT_DURATIONS[toast.tone];
        setToasts((current) =>
          [{ ...toast, id, duration }, ...current].slice(0, 3)
        );
        window.setTimeout(() => dismissToast(id), duration);
      },
    }),
    [dismissToast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed top-4 right-4 z-[9999] flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-3 lg:top-6 lg:right-6 pointer-events-none">
        {toasts.map((toast) => {
          const IconComponent = toneIcons[toast.tone];
          const styles = toneStyles[toast.tone];
          const isExiting = exiting.has(toast.id);

          return (
            <div
              className={cn(
                "relative overflow-hidden rounded-[16px] p-4 shadow-[0_8px_30px_rgb(0,0,0,0.08)] backdrop-blur-xl bg-white/95 border border-slate-100/80 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] pointer-events-auto group",
                isExiting
                  ? "translate-x-[120%] opacity-0 scale-95"
                  : "animate-fade-in translate-x-0 opacity-100 scale-100",
              )}
              key={toast.id}
            >
              {/* Artwork Watermark */}
              <div className={cn("absolute -bottom-6 -right-4 opacity-[0.04] pointer-events-none transition-transform duration-700 group-hover:scale-110 group-hover:opacity-[0.06]", styles.artwork)}>
                <IconComponent size={100} stroke={1.5} />
              </div>

              <div className="flex gap-3 items-start relative z-10">
                <div
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-full border shadow-sm",
                    styles.icon,
                    styles.iconBg,
                  )}
                >
                  <IconComponent aria-hidden size={18} stroke={2} />
                </div>
                <div className="min-w-0 flex-1 pt-0.5">
                  <p className="text-sm font-medium text-slate-900 tracking-tight leading-snug">
                    {toast.title}
                  </p>
                  {toast.body ? (
                    <p className="mt-1 text-[13px] text-slate-500 leading-relaxed">
                      {toast.body}
                    </p>
                  ) : null}
                </div>
                <button
                  aria-label="Dismiss notification"
                  className="focus-ring flex size-7 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                  onClick={() => dismissToast(toast.id)}
                  type="button"
                >
                  <IconX aria-hidden size={14} stroke={2.5} />
                </button>
              </div>
              {/* Auto-dismiss progress bar */}
              <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-slate-100">
                <div
                  className={cn("h-full", {
                    "bg-emerald-400": toast.tone === "success",
                    "bg-amber-400": toast.tone === "warning",
                    "bg-rose-400": toast.tone === "error",
                    "bg-blue-400": toast.tone === "info",
                  })}
                  style={{
                    animation: `progressShrink ${toast.duration}ms linear forwards`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }

  return context;
}
