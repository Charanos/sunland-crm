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
      description={description}
      onClose={isLoading ? () => {} : onClose}
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
          <p className="text-slate-500 leading-relaxed text-base">
            This action is intentional and will be recorded in the activity log
            when audit logging is enabled.
          </p>
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
