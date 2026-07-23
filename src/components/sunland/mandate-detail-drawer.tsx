"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  IconBuildingCommunity,
  IconEye,
  IconStar,
  IconStarFilled,
  IconUserCircle,
  IconMessageCircle,
  IconFileCheck,
  IconFileUpload,
  IconBan,
  IconReceipt2,
} from "@tabler/icons-react";
import { Button, Avatar, Badge } from "@/components/ui/erp-primitives";
import { Drawer } from "@/components/ui/drawer";
import { formatCompactKES } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import { MANDATE_LETTER_STATUS_META, type MandateLetterStatus } from "./mandate-constants";

export interface MandateDrawerItem {
  id: string;
  propertyId: string;
  propertyName: string;
  propertyCode: string;
  landlordContactId: string;
  landlordName: string;
  landlordAvatarUrl?: string | null;
  landlordCompanyName?: string | null;
  mandateRate: string;
  unitCount: number;
  startDate: string;
  endDate: string | null;
  status: "draft" | "pending_approval" | "active" | "terminated";
  createdAt: string;
  assignedPmId: string | null;
  managerName: string | null;
  managerTitle: string | null;
  managerAvatarUrl: string | null;
  currentPeriodCollected?: number;
  pendingRemittanceId?: string | null;
  propertyMedia?: Array<{ url: string; isPrimary?: boolean }> | null;
  paperworkStatus: MandateLetterStatus;
  originValuation: { id: string; valuationCode: string } | null;
  isFeatured?: boolean | null;
}

interface AuditEntry {
  id: string;
  summary: string;
  createdAt: string;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "Just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  return days === 1 ? "Yesterday" : `${days}d ago`;
}

function getInitials(name?: string | null): string {
  if (!name) return "??";
  const parts = name.trim().split(" ");
  if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export function MandateDetailDrawer({
  mandate,
  open,
  entityId,
  onClose,
  canManage,
  onToggleFeature,
  onOpenLandlordProfile,
  onOpenRemittanceAdvice,
  onAttachLetter,
  onTerminate,
}: {
  mandate: MandateDrawerItem | null;
  open: boolean;
  entityId?: string;
  onClose: () => void;
  canManage?: boolean;
  onToggleFeature?: (propertyId: string, currentlyFeatured: boolean) => void;
  onOpenLandlordProfile?: (mandate: MandateDrawerItem) => void;
  onOpenRemittanceAdvice?: (mandate: MandateDrawerItem) => void;
  onAttachLetter?: (mandate: MandateDrawerItem) => void;
  onTerminate?: (mandate: MandateDrawerItem) => void;
}) {
  const [activity, setActivity] = useState<AuditEntry[]>([]);

  useEffect(() => {
    if (!open || !mandate || !entityId) {
      Promise.resolve().then(() => setActivity([]));
      return;
    }
    fetch(
      `/api/audit?entityId=${entityId}&associatedType=mandate&associatedId=${mandate.id}&limit=10`
    )
      .then((r) => r.json())
      .then((data) => setActivity(Array.isArray(data.entries) ? data.entries : []))
      .catch(() => setActivity([]));
  }, [open, mandate, entityId]);

  if (!mandate) return null;

  const rate = parseFloat(mandate.mandateRate) || 0.08;
  const collected = mandate.currentPeriodCollected ?? 0;
  const remittanceDue = collected * (1 - rate);
  const remittanceDisplay = mandate.status === "active" && collected > 0 ? formatCompactKES(remittanceDue) : "—";

  // MTD collection percentage approximation based on target/collected
  const estimatedTarget = 500000;
  const pct = Math.min(100, Math.round((collected / estimatedTarget) * 100));
  const pctColor = pct >= 100 ? "bg-emerald-500" : pct >= 80 ? "bg-emerald-400" : pct >= 50 ? "bg-amber-400" : pct > 0 ? "bg-red-400" : "bg-[#151936]";
  const pctTextColor = pct >= 100 ? "text-emerald-600" : pct >= 80 ? "text-emerald-500" : pct >= 50 ? "text-amber-500" : pct > 0 ? "text-red-500" : "text-slate-600";

  const displayCode = mandate.propertyCode
    ? `MND-${mandate.propertyCode.slice(-4).toUpperCase()}`
    : `MND-${mandate.id.slice(0, 4).toUpperCase()}`;

  const isVerified = mandate.paperworkStatus === "verified";

  return (
    <Drawer open={open} onClose={onClose} title="Mandate Executive Summary" width="34rem">
      <div className="flex flex-col gap-6 pb-6">
        {/* Hero Artwork / Image Banner */}
        <div className="relative h-44 w-full rounded-[24px] overflow-hidden bg-slate-900 shadow-md border border-slate-200/80">
          {mandate.propertyMedia?.[0]?.url ? (
            <Image
              src={mandate.propertyMedia[0].url}
              alt={mandate.propertyName}
              fill
              className="object-cover opacity-85"
              sizes="544px"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-[#151936] to-slate-800 flex items-center justify-center text-slate-500">
              <IconBuildingCommunity size={56} stroke={1.2} className="text-white/20" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

          {/* Top Floating Badges */}
          <div className="absolute top-4 left-4 right-4 flex items-center justify-between gap-2 z-10">
            <span className="bg-black/60 backdrop-blur-md text-white font-mono text-xs px-3 py-1 rounded-full border border-white/20 tracking-wide uppercase">
              {displayCode}
            </span>

            <div className="flex items-center gap-1.5">
              {onToggleFeature && (
                <button
                  type="button"
                  onClick={() => onToggleFeature(mandate.propertyId, !!mandate.isFeatured)}
                  className={cn(
                    "size-8 rounded-full flex items-center justify-center backdrop-blur-md transition-all shadow-sm",
                    mandate.isFeatured
                      ? "bg-amber-400 text-[#151936]"
                      : "bg-black/50 border border-white/20 text-white/70 hover:text-amber-400"
                  )}
                >
                  {mandate.isFeatured ? <IconStarFilled size={15} /> : <IconStar size={15} />}
                </button>
              )}
              <Badge tone={mandate.status === "active" ? "success" : mandate.status === "pending_approval" ? "warning" : "neutral"}>
                {mandate.status.replace("_", " ").toUpperCase()}
              </Badge>
            </div>
          </div>

          {/* Bottom Property Overlay */}
          <div className="absolute bottom-4 left-4 right-4 z-10">
            <h3 className="text-xl font-medium text-white leading-tight drop-shadow-sm truncate">
              {mandate.propertyName}
            </h3>
            <p className="text-xs text-white/80 font-mono tracking-wide mt-0.5">
              Landlord: {mandate.landlordName}
            </p>
          </div>
        </div>

        {/* Primary Action Buttons */}
        <div className="flex items-center gap-3">
          <Link href={`/admin/mandates/${mandate.id}`} className="flex-1">
            <Button className="w-full justify-center bg-tertiary-gradient text-white hover:bg-[#1f244a] font-medium shadow-sm text-xs py-2 rounded-xl gap-2">
              <IconEye size={13} /> View Full Mandate File
            </Button>
          </Link>

          {!isVerified && onAttachLetter ? (
            <Button
              variant="secondary"
              onClick={() => onAttachLetter(mandate)}
              className="bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100 text-xs py-2 rounded-xl gap-1.5"
            >
              <IconFileUpload size={13} /> Attach Letter
            </Button>
          ) : mandate.status === "active" && onOpenRemittanceAdvice ? (
            <Button
              variant="secondary"
              onClick={() => onOpenRemittanceAdvice(mandate)}
              className="bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 text-xs py-2 rounded-xl gap-1.5"
            >
              <IconReceipt2 size={13} /> Remittance
            </Button>
          ) : null}
        </div>

        {/* Executive KPI Overview */}
        <div className="grid grid-cols-3 gap-3 bg-slate-50/80 p-4 rounded-[22px] border border-slate-200/80">
          <div className="flex flex-col gap-0.5">
            <span className="text-xxs font-medium text-slate-400 uppercase tracking-wider">Management Fee</span>
            <span className="font-mono text-lg font-medium text-slate-900">{(rate * 100).toFixed(1)}%</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-xxs font-medium text-slate-400 uppercase tracking-wider">Collection MTD</span>
            <span className="font-mono text-lg font-medium text-slate-900">{formatCompactKES(collected)}</span>
          </div>
          <div className="flex flex-col gap-0.5 text-right">
            <span className="text-xxs font-medium text-slate-400 uppercase tracking-wider">Remittance Due</span>
            <span className={cn("font-mono text-lg font-medium", mandate.status === "active" && collected > 0 ? "text-emerald-600" : "text-slate-400")}>
              {remittanceDisplay}
            </span>
          </div>
        </div>

        {/* Collection MTD Progress Bar */}
        <div className="flex flex-col gap-2 bg-white p-4 rounded-[22px] border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xxs font-medium text-slate-500 font-mono tracking-wider uppercase">Collection MTD Target</span>
            <span className={cn("text-xs font-mono font-medium", pctTextColor)}>{pct}% Collected</span>
          </div>
          <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
            <div style={{ width: `${pct}%` }} className={cn("h-full rounded-full transition-all duration-500", pctColor)} />
          </div>
          <div className="flex items-center justify-between mt-0.5 text-xxs text-slate-400 font-mono">
            <span>01 {new Date().toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })}</span>
            <span>31 {new Date().toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })}</span>
          </div>
        </div>

        {/* Actors Card (Landlord & Property Manager) */}
        <div className="flex flex-col gap-3 bg-white p-4 rounded-[22px] border border-slate-200/80 shadow-2xs">
          <h4 className="text-xs font-mono text-slate-400 uppercase tracking-wider">Stakeholders & Management</h4>

          {/* Landlord Row */}
          <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-50/80 border border-slate-100">
            <div className="flex items-center gap-3 min-w-0">
              <Avatar
                src={mandate.landlordAvatarUrl || undefined}
                fallback={getInitials(mandate.landlordName)}
                className="size-9 bg-white text-slate-800 text-xs border border-slate-200 shrink-0 shadow-2xs"
              />
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-medium text-slate-900 truncate">{mandate.landlordName}</span>
                <span className="text-xxs text-slate-400 font-mono tracking-wider uppercase">
                  {(mandate.landlordCompanyName || "Individual Landlord").toUpperCase()}
                </span>
              </div>
            </div>

            {onOpenLandlordProfile && (
              <button
                type="button"
                onClick={() => onOpenLandlordProfile(mandate)}
                className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs transition-colors shrink-0"
              >
                <IconUserCircle size={14} /> Profile
              </button>
            )}
          </div>

          {/* Manager Row */}
          <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-50/80 border border-slate-100">
            <div className="flex items-center gap-3 min-w-0">
              <Avatar
                src={mandate.managerAvatarUrl || undefined}
                fallback={getInitials(mandate.managerName)}
                className="size-9 bg-[#151936] text-white text-xs shrink-0 shadow-2xs"
              />
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-medium text-slate-900 truncate">{mandate.managerName ?? "Unassigned"}</span>
                <span className="text-xxs text-slate-400 font-mono uppercase tracking-wider">{mandate.managerTitle ?? "Property Manager"}</span>
              </div>
            </div>

            <Link href="/admin/messages" className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs transition-colors shrink-0">
              <IconMessageCircle size={14} /> Message
            </Link>
          </div>
        </div>

        {/* Paperwork & Compliance Section */}
        <div className="flex flex-col gap-3 bg-white p-4 rounded-[22px] border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-mono text-slate-400 uppercase tracking-wider">Compliance & Paperwork</h4>
            <Badge tone={MANDATE_LETTER_STATUS_META[mandate.paperworkStatus].tone}>
              {MANDATE_LETTER_STATUS_META[mandate.paperworkStatus].label}
            </Badge>
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50/80 border border-slate-100 text-xs">
            <div className="flex items-center gap-2 text-slate-700">
              {isVerified ? (
                <IconFileCheck size={16} className="text-emerald-600 shrink-0" />
              ) : (
                <IconFileUpload size={16} className="text-amber-600 shrink-0" />
              )}
              <span className="font-medium text-slate-800">
                {isVerified ? "Mandate Letter Executed & On File" : "Mandate Letter Pending Upload"}
              </span>
            </div>
            {mandate.originValuation && (
              <span className="text-xxs font-mono text-slate-500 bg-slate-200/60 px-2 py-0.5 rounded">
                VAL-{mandate.originValuation.valuationCode}
              </span>
            )}
          </div>
        </div>

        {/* Recent Audit Trail Feed */}
        <div className="flex flex-col gap-3 bg-white p-4 rounded-[22px] border border-slate-200/80 shadow-2xs">
          <h4 className="text-xs font-mono text-slate-400 uppercase tracking-wider">Recent Activity & Audit Trail</h4>
          {activity.length === 0 ? (
            <p className="text-xs text-slate-400 italic py-2">No recent audit log entries recorded for this mandate.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {activity.map((entry) => (
                <div key={entry.id} className="py-2.5 flex items-start justify-between gap-3 text-xs">
                  <span className="text-slate-700 font-medium leading-snug">{entry.summary}</span>
                  <span className="text-xxs font-mono text-slate-400 shrink-0">{relativeTime(entry.createdAt)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Danger Action Zone */}
        {onTerminate && (mandate.status === "active" || mandate.status === "pending_approval") && (
          <div className="pt-2">
            <Button
              variant="secondary"
              onClick={() => onTerminate(mandate)}
              className="w-full justify-center border-rose-200 text-rose-600 hover:bg-rose-50 text-xs py-2.5 rounded-xl gap-2"
            >
              <IconBan size={15} /> Terminate Mandate
            </Button>
          </div>
        )}
      </div>
    </Drawer>
  );
}
