"use client";

import { IconAlertTriangle, IconInfoCircle } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

type ConfirmTone = "danger" | "warning" | "info";

export function ConfirmDialog({
  cancelLabel = "Cancel",
  confirmLabel = "Confirm",
  description,
  isLoading = false,
  onClose,
  onConfirm,
  open,
  title,
  tone = "danger",
  notes,
}: {
  cancelLabel?: string;
  confirmLabel?: string;
  description: string;
  isLoading?: boolean;
  onClose: () => void;
  onConfirm: () => void;
  open: boolean;
  title: string;
  tone?: ConfirmTone;
  /** Optional reason/notes field rendered above the action buttons. */
  notes?: {
    label: string;
    placeholder?: string;
    value: string;
    onChange: (value: string) => void;
    required?: boolean;
    error?: string;
  };
}) {
  const IconComponent = tone === "info" ? IconInfoCircle : IconAlertTriangle;
  const confirmVariant = tone === "danger" ? "danger" : "primary";

  const toneColor =
    tone === "danger"
      ? "bg-red-50 text-red-600 border-red-100"
      : tone === "warning"
        ? "bg-amber-50 text-amber-600 border-amber-100"
        : "bg-blue-50 text-blue-600 border-blue-100";

  return (
    <Modal
      onClose={isLoading ? () => { } : onClose}
      open={open}
      title={title}
      size="sm"
    >
      <div className="flex gap-4">
        <div
          className={`flex size-11 shrink-0 items-center justify-center rounded-xl border ${toneColor}`}
        >
          <IconComponent aria-hidden size={22} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-slate-400 leading-relaxed text-base">
            {description}
          </p>
          {notes && (
            <div className="mt-4">
              <label className="block text-slate-400 mb-1.5 label-caps">
                {notes.label}{notes.required && " — required"}
              </label>
              <textarea
                rows={2}
                value={notes.value}
                onChange={(e) => notes.onChange(e.target.value)}
                placeholder={notes.placeholder}
                disabled={isLoading}
                className="w-full px-3.5 py-2.5 text-slate-800 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-[#151936]/40 focus:ring-1 focus:ring-[#151936]/10 transition-colors shadow-sm resize-y"
              />
              {notes.error && <p className="body-sm text-rose-600 mt-1.5">{notes.error}</p>}
            </div>
          )}
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button onClick={onClose} variant="secondary" disabled={isLoading}>
              {cancelLabel}
            </Button>
            <Button
              onClick={() => {
                onConfirm();
              }}
              variant={confirmVariant}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <LoadingSpinner size="sm" />
                  <span>Processing…</span>
                </>
              ) : (
                confirmLabel
              )}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
