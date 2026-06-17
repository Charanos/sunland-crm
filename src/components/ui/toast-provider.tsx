"use client";

import { createContext, useContext, useMemo, useState } from "react";
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
};

type ToastContextValue = {
  pushToast: (toast: Omit<Toast, "id">) => void;
  dismissToast: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const toneStyles: Record<ToastTone, string> = {
  success: "border-[var(--success)]",
  warning: "border-[var(--warning)]",
  error: "border-[var(--error)]",
  info: "border-[var(--tertiary)]",
};

const toneIcons = {
  success: IconCheck,
  warning: IconAlertTriangle,
  error: IconX,
  info: IconInfoCircle,
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const value = useMemo<ToastContextValue>(
    () => ({
      dismissToast(id) {
        setToasts((current) => current.filter((item) => item.id !== id));
      },
      pushToast(toast) {
        const id = crypto.randomUUID();
        setToasts((current) => [{ ...toast, id }, ...current].slice(0, 3));
        window.setTimeout(
          () =>
            setToasts((current) => current.filter((item) => item.id !== id)),
          toast.tone === "error" ? 6000 : 4000,
        );
      },
    }),
    [],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed bottom-24 right-4 z-50 flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-3 lg:bottom-4">
        {toasts.map((toast) => {
          const IconComponent = toneIcons[toast.tone];

          return (
            <div
              className={cn(
                "rounded-lg border-l-4 bg-white p-4 shadow-xl",
                toneStyles[toast.tone],
              )}
              key={toast.id}
            >
              <div className="flex gap-3">
                <IconComponent aria-hidden size={20} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{toast.title}</p>
                  {toast.body ? (
                    <p className="body-sm mt-1 text-[var(--on-surface-dim)]">
                      {toast.body}
                    </p>
                  ) : null}
                </div>
                <button
                  aria-label="Dismiss notification"
                  className="focus-ring flex size-7 shrink-0 items-center justify-center rounded-full text-[var(--on-surface-dim)] hover:bg-black/[0.05] hover:text-[var(--on-surface)]"
                  onClick={() => value.dismissToast(toast.id)}
                  type="button"
                >
                  <IconX aria-hidden size={15} />
                </button>
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
