"use client";

import { IconAlertTriangle, IconShieldCheck, IconAlertCircle } from "@tabler/icons-react";
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
  const IconComponent = tone === "info" ? IconShieldCheck : tone === "warning" ? IconAlertTriangle : IconAlertCircle;
  const confirmVariant = tone === "danger" ? "danger" : "primary";

  const toneColor =
    tone === "danger"
      ? "bg-rose-50/80 text-rose-600 border-rose-200/80 shadow-2xs"
      : tone === "warning"
        ? "bg-amber-50/80 text-amber-600 border-amber-200/80 shadow-2xs"
        : "bg-slate-50 text-[#151936] border-slate-200 shadow-2xs";

  return (
    <Modal
      onClose={isLoading ? () => { } : onClose}
      open={open}
      title={title}
      size="md"
    >
      <div className="flex flex-col gap-4 py-1">
        <div className="flex items-start gap-4">
          <div className={`flex size-11 shrink-0 items-center justify-center rounded-2xl border ${toneColor}`}>
            <IconComponent aria-hidden size={22} stroke={2} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              {description}
            </p>
          </div>
        </div>

        {notes && (
          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4 space-y-2 shadow-2xs">
            <label className="font-mono text-xxs font-medium uppercase tracking-wider text-slate-500 block">
              {notes.label}{notes.required && " — Required"}
            </label>
            <textarea
              rows={2.5}
              value={notes.value}
              onChange={(e) => notes.onChange(e.target.value)}
              placeholder={notes.placeholder}
              disabled={isLoading}
              className="w-full px-3.5 py-2.5 text-xs text-slate-900 bg-white border border-slate-200/90 rounded-xl focus:outline-none focus:border-[#151936] focus:ring-1 focus:ring-[#151936] transition-all shadow-2xs resize-y"
            />
            {notes.error && <p className="text-xs font-medium text-rose-600 mt-1">{notes.error}</p>}
          </div>
        )}

        <div className="mt-2 flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
          <Button
            type="button"
            onClick={onClose}
            variant="secondary"
            disabled={isLoading}
            className="rounded-xl text-xs px-4 py-2 font-medium"
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            variant={confirmVariant}
            disabled={isLoading}
            className="rounded-xl text-xs px-5 py-2 font-medium shadow-2xs"
          >
            {isLoading ? (
              <div className="flex items-center gap-2">
                <LoadingSpinner size="sm" className="text-current" />
                <span>Processing...</span>
              </div>
            ) : (
              confirmLabel
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

