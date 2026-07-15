"use client";

import { useState } from "react";
import { CldUploadButton } from "next-cloudinary";
import { IconX, IconCloudUpload, IconFileTypePdf, IconPhoto } from "@tabler/icons-react";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast-provider";
import { Button } from "@/components/ui/button";

// Cloudinary is a declared dependency but not yet configured in every
// environment (cloud name + upload preset) - same graceful-degradation
// pattern as property-form-modal.tsx's photo upload: offer the widget when
// configured, always keep the URL field as a working fallback otherwise.
const CLOUDINARY_CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
const CLOUDINARY_CONFIGURED = Boolean(CLOUDINARY_CLOUD_NAME && CLOUDINARY_UPLOAD_PRESET);

interface MandateLetterModalProps {
  open: boolean;
  entityId: string | null;
  ownerContactId: string;
  propertyName: string;
  landlordName: string;
  hasExistingLetter: boolean;
  onClose: () => void;
  onAttached: () => void;
}

export function MandateLetterModal({
  open,
  entityId,
  ownerContactId,
  propertyName,
  landlordName,
  hasExistingLetter,
  onClose,
  onAttached,
}: MandateLetterModalProps) {
  const { pushToast } = useToast();
  const [url, setUrl] = useState("");
  const [stagedName, setStagedName] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityId,
          type: "mandate_letter",
          title: `${propertyName} - Mandate Letter`,
          fileUrl: url.trim(),
          ownerContactId,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Failed to attach mandate letter");

      pushToast({ tone: "success", title: "Mandate letter attached", body: `Saved against ${landlordName}'s document record.` });
      onAttached();
      onClose();
      setUrl("");
    } catch (err) {
      pushToast({ tone: "warning", title: "Error", body: err instanceof Error ? err.message : "Could not attach mandate letter." });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={submitting ? () => { } : onClose}
      title={`${hasExistingLetter ? "Replace" : "Upload"} Mandate Letter`}
      description={`${propertyName} · ${landlordName}`}
      size="sm"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {url ? (
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-3 shadow-sm">
            {stagedName?.toLowerCase().endsWith(".pdf") ? (
              <IconFileTypePdf size={20} className="text-[#122a20] shrink-0" aria-hidden="true" />
            ) : (
              <IconPhoto size={20} className="text-[#122a20] shrink-0" aria-hidden="true" />
            )}
            <span className="flex-1 min-w-0 body-sm text-slate-800 truncate">{stagedName ?? url}</span>
            <button
              type="button"
              onClick={() => { setUrl(""); setStagedName(null); }}
              aria-label="Remove selected file"
              className="text-slate-300 hover:text-rose-500 shrink-0"
            >
              <IconX size={16} />
            </button>
          </div>
        ) : CLOUDINARY_CONFIGURED ? (
          <CldUploadButton
            uploadPreset={CLOUDINARY_UPLOAD_PRESET}
            options={{ resourceType: "auto" }}
            onSuccess={(results) => {
              const info = results.info;
              if (info && typeof info === "object" && "secure_url" in info) {
                setUrl(info.secure_url as string);
                setStagedName("original_filename" in info ? String(info.original_filename) : null);
              }
            }}
            className="flex flex-col items-center justify-center gap-2 w-full rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/60 py-8 text-center cursor-pointer hover:border-[#f3df27] hover:bg-[#fffdf0] transition-colors"
          >
            <IconCloudUpload size={26} className="text-slate-400" aria-hidden="true" />
            <span className="body-sm text-slate-700 font-medium">Drag the mandate letter here, or click to browse</span>
            <span className="text-meta-muted">PDF or image · up to 10MB</span>
          </CldUploadButton>
        ) : (
          <div>
            <label className="label-caps text-slate-400 mb-1.5 block">Document URL</label>
            <input
              required
              type="url"
              placeholder="https://…"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-body-primary focus:outline-none focus:border-[#151936]/40 transition-colors shadow-sm"
            />
            <p
              className="text-meta-muted mt-1.5"
              title="Cloudinary isn't configured yet (NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME / NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET) - paste a document URL instead."
            >
              Upload widget unavailable in this environment - paste a document URL instead.
            </p>
          </div>
        )}
        <p className="body-sm text-slate-400">
          Saved against {landlordName}&apos;s document record, so it stays attached to every property they own -
          not just this one.
        </p>

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting || !url.trim()}>
            {submitting ? "Saving..." : hasExistingLetter ? "Replace Letter" : "Attach Letter"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
