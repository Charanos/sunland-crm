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

  // Compact JSON - scanners read this and can redirect to verify URL
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
      await navigator.share({ title: `Sunland QR - ${artifactRef}`, text: `Verify ${artifactType}: ${artifactRef}`, url });
    } else {
      await handleCopy();
    }
  };

  return (
    <section
      className={cn(
        "rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white to-slate-50/50 shadow-xs transition-all duration-300",
        compact ? "p-4 sm:p-5" : "p-6"
      )}
      aria-label="Secure QR artifact verification"
    >
      <div className={cn("grid gap-5 items-start", compact ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-[auto_1fr]")}>

        {/* ── QR Code + Header Header ────────────────────────── */}
        <div className={cn("flex gap-4 shrink-0", compact ? "items-center" : "flex-col items-center")}>
          <div className={cn(
            "relative rounded-2xl border border-slate-200 bg-white p-2.5 shadow-2xs overflow-hidden group shrink-0",
            verified && "ring-2 ring-emerald-400 ring-offset-2"
          )}>
            {/* Scan animation line */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent opacity-0 group-hover:opacity-100 group-hover:animate-scan" />

            <QRCodeSVG
              ref={qrRef}
              value={qrPayload}
              size={compact ? 104 : 148}
              bgColor="#ffffff"
              fgColor="#151936"
              level="H"
              marginSize={1}
              imageSettings={{
                src: "/logo.png",
                x: undefined,
                y: undefined,
                height: 20,
                width: 20,
                excavate: true,
              }}
            />

            {/* Verified badge overlay */}
            {verified && (
              <div className="absolute -bottom-2 -right-2 flex size-6 items-center justify-center rounded-full bg-emerald-500 text-white border-2 border-white shadow-2xs animate-scale-in">
                <IconCheck size={12} stroke={3} />
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge tone={verified ? "success" : "primary"} className="gap-1 px-2 py-0.5 text-xxs font-mono">
                {verified ? <IconShieldCheck size={13} /> : <IconQrcode size={13} />}
                {verified ? "Verified Authentic" : "Scan to Verify"}
              </Badge>
              <span className="font-mono text-xxs bg-slate-100 text-slate-600 border border-slate-200/80 px-2 py-0.5 rounded-full font-medium">
                {artifactRef}
              </span>
            </div>

            <h3 className="text-base sm:text-lg font-medium tracking-tight text-slate-900 mt-1 leading-snug">{artifactType}</h3>

            {compact && (
              <button
                type="button"
                onClick={downloadQr}
                className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-xxs font-medium text-slate-600 hover:bg-slate-50 transition-colors shadow-2xs mt-1 w-fit"
              >
                <IconDownload size={12} /> Download QR
              </button>
            )}
          </div>
        </div>

        {/* ── Metadata + Actions ──────────────────────────────── */}
        <div className="min-w-0 flex flex-col justify-center h-full">
          {!compact && (
            <p className="leading-relaxed text-slate-500 text-xs max-w-xl">
              This document carries a cryptographically generated QR code ensuring its authenticity. Scan the code to verify this artifact against the central immutable registry.
            </p>
          )}

          {/* Meta grid */}
          <div className={cn("grid gap-2.5", compact ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4 mt-4")}>
            {[
              { label: "Entity", value: entityName },
              { label: "Generated", value: new Date(generatedAt).toLocaleDateString("en-KE", { day: "numeric", month: "short" }) },
              { label: "Token ID", value: token.slice(0, 8).toUpperCase(), mono: true },
              { label: "Value Auth", value: typeof amount === "number" ? formatCompactKES(amount) : "Document only", mono: true },
            ].map(item => (
              <div key={item.label} className="rounded-xl border border-slate-100 bg-white p-2.5 shadow-2xs transition-colors hover:border-slate-200">
                <p className="text-slate-400 font-mono text-xxs uppercase tracking-wider">{item.label}</p>
                <p className={cn("mt-0.5 text-slate-800 truncate text-xs font-medium", item.mono && "font-mono")}>{item.value}</p>
              </div>
            ))}

            {/* Extra metadata fields */}
            {metadata && Object.entries(metadata).map(([key, val]) => (
              <div key={key} className="rounded-xl border border-slate-100 bg-white p-2.5 shadow-2xs transition-colors hover:border-slate-200">
                <p className="text-slate-400 font-mono text-xxs uppercase tracking-wider">{key}</p>
                <p className="mt-0.5 text-slate-800 truncate text-xs font-mono font-medium">{String(val)}</p>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => setVerified(true)}
              disabled={verified}
              className={cn(
                "transition-all text-xs rounded-xl px-3.5 py-1.5 font-medium flex-1 sm:flex-none justify-center",
                verified ? "bg-emerald-500 text-white hover:bg-emerald-600" : "bg-[#151936] text-white hover:bg-slate-800"
              )}
            >
              <IconShieldCheck size={14} />
              {verified ? "Verified" : "Authenticate Record"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleCopy}
              className="bg-white hover:bg-slate-50 border-slate-200 text-slate-700 rounded-xl text-xs px-3 py-1.5 shadow-2xs font-medium flex-1 sm:flex-none justify-center"
            >
              <IconCopy size={14} />
              {copied ? "Copied" : "Copy Link"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleShare}
              className="bg-white hover:bg-slate-50 border-slate-200 text-slate-700 rounded-xl text-xs px-3 py-1.5 shadow-2xs font-medium flex-1 sm:flex-none justify-center"
            >
              <IconShare size={14} />
              Share
            </Button>
            <Link
              href={verificationPath}
              className="inline-flex h-[32px] items-center gap-1 rounded-xl bg-slate-100 border border-slate-200/80 px-3 transition-colors hover:bg-slate-200 text-slate-700 text-xs font-medium flex-1 sm:flex-none justify-center"
            >
              View Registry <IconExternalLink size={13} />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
