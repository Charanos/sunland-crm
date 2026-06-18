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

const toneStyles: Record<ToastTone, { border: string; icon: string; bg: string }> = {
  success: {
    border: "border border-emerald-100",
    icon: "text-[var(--success)]",
    bg: "bg-[#f0faf4]",
  },
  warning: {
    border: "border border-amber-100",
    icon: "text-[var(--warning)]",
    bg: "bg-[#fffbf0]",
  },
  error: {
    border: "border border-rose-100",
    icon: "text-[var(--error)]",
    bg: "bg-[#fef2f2]",
  },
  info: {
    border: "border border-blue-100",
    icon: "text-[var(--tertiary)]",
    bg: "bg-[#f0f4ff]",
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
    }, 280);
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
      <div className="fixed bottom-24 right-4 z-[200] flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2.5 lg:bottom-4">
        {toasts.map((toast) => {
          const IconComponent = toneIcons[toast.tone];
          const styles = toneStyles[toast.tone];
          const isExiting = exiting.has(toast.id);

          return (
            <div
              className={cn(
                "relative overflow-hidden rounded-xl p-4 shadow-[0_12px_36px_rgba(0,0,0,0.06)] backdrop-blur-md transition-all duration-280",
                styles.border,
                styles.bg,
                isExiting
                  ? "translate-x-[110%] opacity-0"
                  : "animate-slide-in-up translate-x-0 opacity-100",
              )}
              key={toast.id}
            >
              <div className="flex gap-3">
                <div
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-lg",
                    styles.icon,
                    styles.bg,
                  )}
                >
                  <IconComponent aria-hidden size={18} stroke={2} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-slate-800">
                    {toast.title}
                  </p>
                  {toast.body ? (
                    <p className="mt-0.5 text-[12px] text-slate-500 leading-relaxed">
                      {toast.body}
                    </p>
                  ) : null}
                </div>
                <button
                  aria-label="Dismiss notification"
                  className="focus-ring flex size-6 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-black/[0.05] hover:text-slate-600 transition-colors"
                  onClick={() => dismissToast(toast.id)}
                  type="button"
                >
                  <IconX aria-hidden size={14} />
                </button>
              </div>
              {/* Auto-dismiss progress bar */}
              <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-black/[0.03]">
                <div
                  className={cn("h-full rounded-full opacity-40", {
                    "bg-[var(--success)]": toast.tone === "success",
                    "bg-[var(--warning)]": toast.tone === "warning",
                    "bg-[var(--error)]": toast.tone === "error",
                    "bg-[var(--tertiary)]": toast.tone === "info",
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
