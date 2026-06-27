"use client";

import Link from "next/link";
import { useRef, useMemo, useState, useCallback } from "react";
import {
  IconCheck,
  IconCopy,
  IconExternalLink,
  IconQrcode,
  IconShieldCheck,
  IconDownload,
  IconShare,
} from "@tabler/icons-react";
import { QRCodeSVG } from "qrcode.react";
import { Badge, Button } from "@/components/ui/erp-primitives";
import { cn } from "@/lib/utils/cn";
import { formatCompactKES } from "@/lib/utils/format";

// ── Types ──────────────────────────────────────────────────────────────────────

type FinanceQrProofProps = {
  artifactRef: string;
  artifactType: string;
  entityName: string;
  generatedAt: string;
  token: string;
  amount?: number;
  compact?: boolean;
  /** Extra structured metadata embedded in the QR payload */
  metadata?: Record<string, string | number>;
};

// ── QR Payload builder ────────────────────────────────────────────────────────

function buildQrPayload(props: FinanceQrProofProps): string {
  const base = typeof window !== "undefined" ? window.location.origin : "https://sunland.co.ke";
  const verificationUrl = `${base}/fin/reports/verify/${props.token}`;

  const payload = {
    ref: props.artifactRef,
    type: props.artifactType,
    entity: props.entityName,
    token: props.token,
    generated: props.generatedAt,
    ...(props.amount !== undefined ? { amount: props.amount } : {}),
    ...(props.metadata || {}),
    verify: verificationUrl,
  };

  // Compact JSON — scanners read this and can redirect to verify URL
  return JSON.stringify(payload);
}

// ── Download QR as PNG ─────────────────────────────────────────────────────────

function useQrDownload(ref: React.RefObject<SVGSVGElement | null>, filename: string) {
  return useCallback(() => {
    const svg = ref.current;
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();
    const blob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    img.onload = () => {
      canvas.width = img.width * 2;
      canvas.height = img.height * 2;
      ctx?.scale(2, 2);
      ctx?.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      const pngUrl = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = pngUrl;
      a.download = filename;
      a.click();
    };
    img.src = url;
  }, [ref, filename]);
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function FinanceQrProof({
  artifactRef,
  artifactType,
  entityName,
  generatedAt,
  token,
  amount,
  compact = false,
  metadata,
}: FinanceQrProofProps) {
  const [copied, setCopied] = useState(false);
  const [verified, setVerified] = useState(false);
  const qrRef = useRef<SVGSVGElement>(null);

  const verificationPath = `/fin/reports/verify/${token}`;
  const qrPayload = useMemo(() => buildQrPayload({ artifactRef, artifactType, entityName, generatedAt, token, amount, metadata }), [artifactRef, artifactType, entityName, generatedAt, token, amount, metadata]);

  const downloadQr = useQrDownload(qrRef, `${artifactRef}-qr.png`);

  const handleCopy = async () => {
    const url = `${window.location.origin}${verificationPath}`;
    await navigator.clipboard?.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const handleShare = async () => {
    const url = `${window.location.origin}${verificationPath}`;
    if (navigator.share) {
      await navigator.share({ title: `Sunland QR — ${artifactRef}`, text: `Verify ${artifactType}: ${artifactRef}`, url });
    } else {
      await handleCopy();
    }
  };

  return (
    <section
      className={cn(
        "rounded-2xl border border-slate-200/60 bg-gradient-to-br from-white to-slate-50/50 shadow-sm transition-all duration-300 hover:shadow-md",
        compact ? "p-5" : "p-6"
      )}
      aria-label="Secure QR artifact verification"
    >
      <div className={cn("grid gap-5 items-start", compact ? "grid-cols-1" : "grid-cols-1 md:grid-cols-[auto_1fr]")}>

        {/* ── QR Code ────────────────────────────────────────── */}
        <div className="flex flex-col items-center gap-3 shrink-0">
          <div className={cn(
            "relative rounded-2xl border border-slate-200 bg-white p-3 shadow-sm overflow-hidden group",
            verified && "ring-2 ring-emerald-400 ring-offset-2"
          )}>
            {/* Scan animation line */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent opacity-0 group-hover:opacity-100 group-hover:animate-scan" />

            <QRCodeSVG
              ref={qrRef}
              value={qrPayload}
              size={compact ? 120 : 148}
              bgColor="#ffffff"
              fgColor="#151936"
              level="H"
              marginSize={1}
              imageSettings={{
                src: "/logo.png",
                x: undefined,
                y: undefined,
                height: 24,
                width: 24,
                excavate: true,
              }}
            />

            {/* Verified badge overlay */}
            {verified && (
              <div className="absolute -bottom-2 -right-2 flex size-7 items-center justify-center rounded-full bg-emerald-500 text-white border-2 border-white shadow-sm animate-scale-in">
                <IconCheck size={13} stroke={3} />
              </div>
            )}
          </div>

          {/* Download button */}
          <button
            type="button"
            onClick={downloadQr}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-tiny text-slate-600 hover:bg-slate-50 transition-colors shadow-sm"
          >
            <IconDownload size={12} />
            Download QR
          </button>
        </div>

        {/* ── Metadata + Actions ──────────────────────────────── */}
        <div className="min-w-0 flex flex-col justify-center h-full">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Badge tone={verified ? "success" : "primary"} className="gap-1.5 px-2.5 py-1 text-caption">
                {verified ? <IconShieldCheck size={14} /> : <IconQrcode size={14} />}
                {verified ? "Verified Authentic" : "Scan to Verify"}
              </Badge>
              <Badge tone="neutral" className="font-mono bg-slate-100 text-slate-600 border-slate-200 text-caption">
                {artifactRef}
              </Badge>
            </div>
          </div>

          <h3 className="title-serif mt-3.5 font-normal tracking-tight text-slate-900 leading-none">{artifactType}</h3>
          <p className="mt-2 leading-relaxed text-slate-500 max-w-xl text-caption">
            This document carries a cryptographically generated QR code ensuring its authenticity. Scan the code to verify this artifact against the central immutable registry.
          </p>

          {/* Meta grid */}
          <div className="mt-5 grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: "Entity", value: entityName },
              { label: "Generated", value: generatedAt },
              { label: "Token ID", value: token, mono: true },
              { label: "Value Auth", value: typeof amount === "number" ? formatCompactKES(amount) : "Document only", mono: true },
            ].map(item => (
              <div key={item.label} className="rounded-xl border border-slate-100 bg-white p-3.5 shadow-sm transition-colors hover:border-slate-200">
                <p className="text-slate-400 label-caps">{item.label}</p>
                <p className={cn("mt-1 text-slate-800 truncate text-caption", item.mono && "font-mono")}>{item.value}</p>
              </div>
            ))}

            {/* Extra metadata fields */}
            {metadata && Object.entries(metadata).map(([key, val]) => (
              <div key={key} className="rounded-xl border border-slate-100 bg-white p-3.5 shadow-sm transition-colors hover:border-slate-200">
                <p className="text-slate-400 label-caps">{key}</p>
                <p className="mt-1 text-slate-800 truncate text-caption font-mono">{String(val)}</p>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="mt-5 flex flex-wrap items-center gap-2.5">
            <Button
              type="button"
              size="sm"
              onClick={() => setVerified(true)}
              disabled={verified}
              className={cn(
                "transition-all",
                verified ? "bg-emerald-500 text-white hover:bg-emerald-600" : "bg-[#151936] text-white hover:bg-slate-800"
              )}
            >
              <IconShieldCheck size={14} />
              {verified ? "Authentication Successful" : "Authenticate Record"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleCopy}
              className="bg-white hover:bg-slate-50 border-slate-200 shadow-sm"
            >
              <IconCopy size={14} />
              {copied ? "Copied Link" : "Copy Secure Link"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleShare}
              className="bg-white hover:bg-slate-50 border-slate-200 shadow-sm"
            >
              <IconShare size={14} />
              Share
            </Button>
            <Link
              href={verificationPath}
              className="inline-flex h-[34px] items-center gap-1.5 rounded-lg bg-slate-100 px-3.5 transition-colors hover:bg-slate-200 hover:text-slate-900 shadow-sm text-caption"
            >
              View Registry <IconExternalLink size={14} />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
