"use client";

import { IconAlertTriangle, IconInfoCircle } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

type ConfirmTone = "danger" | "warning" | "info";

export function ConfirmDialog({
  cancelLabel = "Cancel",
  confirmLabel = "Confirm",
  description,
  onClose,
  onConfirm,
  open,
  title,
  tone = "danger",
}: {
  cancelLabel?: string;
  confirmLabel?: string;
  description: string;
  onClose: () => void;
  onConfirm: () => void;
  open: boolean;
  title: string;
  tone?: ConfirmTone;
}) {
  const IconComponent = tone === "info" ? IconInfoCircle : IconAlertTriangle;
  const confirmVariant = tone === "danger" ? "danger" : "primary";

  return (
    <Modal
      description={description}
      onClose={onClose}
      open={open}
      title={title}
    >
      <div className="flex gap-4">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[var(--surface-high)] text-[var(--on-primary)]">
          <IconComponent aria-hidden size={22} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="body-sm text-[var(--on-surface-dim)]">
            This action is intentional and will be recorded in the activity log
            when audit logging is enabled.
          </p>
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button onClick={onClose} variant="secondary">
              {cancelLabel}
            </Button>
            <Button
              onClick={() => {
                onConfirm();
                onClose();
              }}
              variant={confirmVariant}
            >
              {confirmLabel}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
