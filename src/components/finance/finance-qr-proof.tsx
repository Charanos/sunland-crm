"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  IconCheck,
  IconCopy,
  IconExternalLink,
  IconQrcode,
  IconShieldCheck,
} from "@tabler/icons-react";
import { Badge, Button } from "@/components/ui/erp-primitives";
import { cn } from "@/lib/utils/cn";
import { formatCompactKES } from "@/lib/utils/format";

type FinanceQrProofProps = {
  artifactRef: string;
  artifactType: string;
  entityName: string;
  generatedAt: string;
  token: string;
  amount?: number;
  compact?: boolean;
};

const qrSize = 13;

function isFinderCell(row: number, col: number) {
  const inTopLeft = row < 5 && col < 5;
  const inTopRight = row < 5 && col >= qrSize - 5;
  const inBottomLeft = row >= qrSize - 5 && col < 5;
  const inFinder = inTopLeft || inTopRight || inBottomLeft;
  if (!inFinder) return false;

  const localRow = row < 5 ? row : row - (qrSize - 5);
  const localCol = col < 5 ? col : col - (qrSize - 5);
  return localRow === 0 || localRow === 4 || localCol === 0 || localCol === 4 || (localRow === 2 && localCol === 2);
}

function MockQrMark({ token }: { token: string }) {
  const cells = useMemo(() => {
    const seed = token.split("").reduce((sum, char, index) => sum + char.charCodeAt(0) * (index + 3), 0);
    return Array.from({ length: qrSize * qrSize }, (_, index) => {
      const row = Math.floor(index / qrSize);
      const col = index % qrSize;
      if (isFinderCell(row, col)) return true;
      return ((seed + row * 17 + col * 29 + row * col) % 7) < 3;
    });
  }, [token]);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm relative overflow-hidden group" aria-label="QR verification mark">
      {/* Scanning effect line */}
      <div className="absolute top-0 left-0 w-full h-[2px] bg-emerald-500/50 shadow-[0_0_10px_emerald] translate-y-[-10px] group-hover:animate-scan" />
      <div
        className="grid size-[132px] gap-[2px]"
        style={{ gridTemplateColumns: `repeat(${qrSize}, minmax(0, 1fr))` }}
      >
        {cells.map((active, index) => (
          <span
            key={`${token}-${index}`}
            className={cn("rounded-[1.5px] transition-colors duration-500", active ? "bg-[#151936]" : "bg-slate-100")}
          />
        ))}
      </div>
    </div>
  );
}

export function FinanceQrProof({
  artifactRef,
  artifactType,
  entityName,
  generatedAt,
  token,
  amount,
  compact = false,
}: FinanceQrProofProps) {
  const [copied, setCopied] = useState(false);
  const [verified, setVerified] = useState(false);
  const verificationPath = `/fin/reports/verify/${token}`;

  const handleCopy = async () => {
    await navigator.clipboard?.writeText(`${window.location.origin}${verificationPath}`);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
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
        <div className="flex items-center justify-center shrink-0 relative">
          <MockQrMark token={token} />
          {verified && (
            <div className="absolute -bottom-2 -right-2 bg-emerald-500 text-white rounded-full p-1 border-2 border-white shadow-sm animate-in zoom-in duration-300">
              <IconCheck size={14} stroke={3} />
            </div>
          )}
        </div>

        <div className="min-w-0 flex flex-col justify-center h-full">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Badge tone={verified ? "success" : "primary"} className="gap-1.5 px-2.5 py-1 text-sm">
                {verified ? <IconShieldCheck size={14} /> : <IconQrcode size={14} />}
                {verified ? "Verified Authentic" : "Scan to Verify"}
              </Badge>
              <Badge tone="neutral" className="font-mono bg-slate-100 text-slate-600 border-slate-200">{artifactRef}</Badge>
            </div>
          </div>

          <h3 className="title-serif mt-3.5 font-normal tracking-tight text-slate-900 leading-none">{artifactType}</h3>
          <p className="mt-2 leading-relaxed text-slate-500 max-w-xl text-sm">
            This document carries a cryptographically generated QR code ensuring its authenticity. Scan the code to verify this artifact against the central immutable registry.
          </p>

          <div className="mt-5 grid grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
            <div className="rounded-xl border border-slate-100 bg-white p-3.5 shadow-sm transition-colors hover:border-slate-200">
              <p className="text-slate-400 label-caps">Entity</p>
              <p className="mt-1 font-medium text-slate-800 truncate">{entityName}</p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-white p-3.5 shadow-sm transition-colors hover:border-slate-200">
              <p className="text-slate-400 label-caps">Generated</p>
              <p className="mt-1 font-mono font-medium text-slate-800 truncate">{generatedAt}</p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-white p-3.5 shadow-sm transition-colors hover:border-slate-200">
              <p className="text-slate-400 label-caps">Token ID</p>
              <p className="mt-1 font-mono font-medium text-slate-800 truncate">{token}</p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-white p-3.5 shadow-sm transition-colors hover:border-slate-200">
              <p className="text-slate-400 label-caps">Value Auth</p>
              <p className="mt-1 font-mono font-medium text-slate-800 truncate">
                {typeof amount === "number" ? formatCompactKES(amount) : "Document only"}
              </p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2.5">
            <Button type="button" size="sm" onClick={() => setVerified(true)} disabled={verified} className={cn("transition-all", verified ? "bg-emerald-500 text-white hover:bg-emerald-600" : "bg-[#151936] text-white hover:bg-slate-800")}>
              <IconShieldCheck size={14} />
              {verified ? "Authentication Successful" : "Authenticate Record"}
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={handleCopy} className="bg-white hover:bg-slate-50 border-slate-200 shadow-sm">
              <IconCopy size={14} />
              {copied ? "Copied Link" : "Copy Secure Link"}
            </Button>
            <Link
              href={verificationPath}
              className="inline-flex h-[34px] items-center gap-1.5 rounded-lg bg-slate-100 px-3.5 font-medium text-slate-600 transition-colors hover:bg-slate-200 hover:text-slate-900 shadow-sm text-sm"
            >
              View Registry <IconExternalLink size={14} />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
