"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  IconCalendar,
  IconClock,
  IconEdit,
  IconEye,
  IconMail,
  IconMapPin,
  IconPhone,
  IconRefresh,
  IconShield,
  IconTrash,
  IconBuildingCommunity,
  IconReceipt2,
} from "@tabler/icons-react";
import { Button, ConfirmDialog, Avatar, Badge } from "@/components/ui/erp-primitives";
import { Drawer } from "@/components/ui/drawer";
import { formatCompactKES } from "@/lib/utils/format";
import { PROPERTY_TYPE_ICON } from "./property-constants";

interface Lease {
  id: string;
  startsAt: string;
  endsAt: string;
  monthlyRentKes: string;
  depositKes: string | null;
  isActive: boolean;
  propertyId: string;
  tenantContactId: string;
  propertyName: string;
  propertyCode: string;
  propertyType: string;
  propertyLocation?: string;
  tenantName: string;
  tenantEmail: string | null;
  tenantPhone: string | null;
  tenantAvatarUrl?: string | null;
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

export function LeaseDetailDrawer({
  lease,
  open,
  entityId,
  onClose,
  canManage,
  onTerminate,
  onEdit,
  onRenew,
}: {
  lease: Lease | null;
  open: boolean;
  entityId?: string;
  onClose: () => void;
  canManage: boolean;
  onTerminate: (id: string) => Promise<void> | void;
  onEdit?: (lease: Lease) => void;
  onRenew?: (lease: Lease) => void;
}) {
  const [pendingTerminate, setPendingTerminate] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [activity, setActivity] = useState<AuditEntry[]>([]);

  useEffect(() => {
    if (!open || !lease || !entityId) {
      Promise.resolve().then(() => setActivity([]));
      return;
    }
    fetch(
      `/api/audit?entityId=${entityId}&associatedType=lease&associatedId=${lease.id}&limit=10`
    )
      .then((r) => r.json())
      .then((data) => setActivity(Array.isArray(data.entries) ? data.entries : []))
      .catch(() => setActivity([]));
  }, [open, lease, entityId]);

  if (!lease) return null;

  const rentVal = formatCompactKES(parseFloat(lease.monthlyRentKes));
  const PropIcon = (PROPERTY_TYPE_ICON as Record<string, React.ElementType>)[lease.propertyType] ?? IconBuildingCommunity;

  const confirmTerminate = async () => {
    setUpdating(true);
    try {
      await onTerminate(lease.id);
    } finally {
      setUpdating(false);
      setPendingTerminate(false);
    }
  };

  const getInitials = (name: string) => {
    if (!name) return "??";
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  };

  const isExpired = new Date(lease.endsAt) < new Date() && lease.isActive;

  return (
    <>
      <Drawer
        open={open}
        onClose={onClose}
        title="Lease Details"
        width="36rem"
        footer={
          <div className="flex items-center gap-3">
            {canManage && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onEdit?.(lease)}
                className="flex-1 border-transparent shadow-none bg-slate-50 hover:bg-slate-100 text-slate-700 transition-colors"
              >
                <IconEdit size={14} className="mr-1.5" />
                Edit
              </Button>
            )}
            {canManage && lease.isActive && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onRenew?.(lease)}
                className="flex-1 border-transparent shadow-none bg-slate-50 hover:bg-slate-100 text-slate-700 transition-colors"
              >
                <IconRefresh size={14} className="mr-1.5" />
                Renew
              </Button>
            )}
            <Link href={`/admin/leases/${lease.id}`} className="flex-1">
              <Button size="sm" className="w-full bg-[#151936] text-white hover:bg-[#151936]/90 shadow-none border-transparent transition-colors">
                <IconEye size={14} className="mr-1.5" />
                Full View
              </Button>
            </Link>
            {canManage && lease.isActive && (
              <Button
                variant="danger"
                size="sm"
                onClick={() => setPendingTerminate(true)}
                className="px-4 border-transparent shadow-none bg-rose-50 text-rose-600 hover:bg-rose-100 transition-colors"
              >
                <IconTrash size={14} />
              </Button>
            )}
          </div>
        }
      >
        <div className="space-y-8 animate-fade-in-up pb-6">
          {/* ── Hero Image / Artwork Header (Matching PropertyDetailDrawer) ── */}
          <div className="relative aspect-[16/10] sm:aspect-[21/9] w-full rounded-[16px] overflow-hidden bg-gradient-to-br from-[#151936] via-[#1b2146] to-[#0d1024] p-5 sm:p-6 text-white flex flex-col justify-between shadow-sm group">
            <div className="absolute right-0 top-0 size-64 bg-white/5 rounded-full blur-3xl pointer-events-none" />

            {/* Top Row / Badges */}
            <div className="flex items-center justify-between w-full relative z-10">
              <span className="label-caps text-white/70 tracking-widest font-medium">
                Ref #{lease.id.slice(0, 8).toUpperCase()}
              </span>

              <Badge tone={lease.isActive ? (isExpired ? "warning" : "success") : "neutral"}>
                {lease.isActive ? (isExpired ? "Expired Active" : "Active Lease") : "Terminated"}
              </Badge>
            </div>

            {/* Bottom Row / Title */}
            <div className="relative z-10 flex flex-col gap-1">
              <p className="text-white/70 label-caps tracking-widest">{lease.propertyType}</p>
              <h3 className="headline-md text-white tracking-tight leading-tight">{lease.propertyName}</h3>
            </div>
          </div>

          {/* ── Price & Location (Matching PropertyDetailDrawer) ── */}
          <div className="flex flex-col gap-5 border-b border-slate-100 pb-8">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <p className="text-slate-400 label-caps mb-1.5 tracking-widest">Expected Monthly Rent</p>
                <div className="flex items-baseline gap-1.5 text-slate-900">
                  <span className="font-mono font-medium text-4xl sm:text-5xl font-normal tracking-tight">{rentVal.replace("KES ", "").replace("/mo", "")}</span>
                  <span className="text-slate-400 label-caps font-normal">KES / mo</span>
                </div>
              </div>
              <div className="text-left sm:text-right">
                <span className="font-mono font-medium text-2xl font-normal text-slate-900">
                  {lease.depositKes ? formatCompactKES(parseFloat(lease.depositKes)) : "N/A"}
                </span>
                <p className="label-caps text-slate-400 mt-0.5 tracking-widest">Deposit Held</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-slate-500">
              <IconMapPin size={16} stroke={1.2} className="text-slate-400 shrink-0" />
              <span className="body-sm">{lease.propertyLocation || "Sunland Managed Location"}</span>
            </div>
          </div>

          {/* ── Lease Specifications (Sleek Border-Left Grid - Matching Property Specs) ── */}
          <div>
            <p className="label-caps text-slate-400 mb-5 tracking-widest">Lease Specifications</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-6 gap-x-4">
              {[
                { icon: IconCalendar, label: "Starts On", value: new Date(lease.startsAt).toLocaleDateString() },
                { icon: IconCalendar, label: "Ends On", value: new Date(lease.endsAt).toLocaleDateString() },
                { icon: PropIcon, label: "Unit Code", value: lease.propertyCode },
                { icon: IconShield, label: "Tenancy Status", value: lease.isActive ? "Active Resident" : "Former Resident" },
                { icon: IconClock, label: "Duration", value: `${Math.max(1, Math.round((new Date(lease.endsAt).getTime() - new Date(lease.startsAt).getTime()) / (1000 * 60 * 60 * 24 * 30)))} months` },
                { icon: IconReceipt2, label: "Frequency", value: "Monthly" },
              ].map((tile, idx) => (
                <div key={tile.label + idx} className="flex flex-col gap-1.5 border-l border-slate-100 pl-4">
                  <div className="flex items-center gap-1.5 text-slate-400">
                    <tile.icon size={14} stroke={1.5} />
                    <span className="label-caps tracking-widest">{tile.label}</span>
                  </div>
                  <span className="text-sm text-slate-800 font-medium font-mono">{tile.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Principal Tenant (Flush Row - Matching Property Owner) ── */}
          <div className="border-t border-slate-100 pt-8">
            <p className="label-caps text-slate-400 mb-5 tracking-widest">Principal Tenant</p>
            <div className="flex items-center justify-between gap-4 group">
              <div className="flex items-center gap-4">
                <Avatar
                  src={lease.tenantAvatarUrl || undefined}
                  fallback={getInitials(lease.tenantName)}
                  className="size-12 bg-slate-50 text-slate-600 text-sm"
                />
                <div>
                  <p className="text-slate-900 font-medium text-base">{lease.tenantName}</p>
                  <p className="text-slate-500 text-sm mt-0.5">{lease.isActive ? "Resident" : "Former Resident"}</p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {lease.tenantPhone && (
                  <a
                    href={`tel:${lease.tenantPhone}`}
                    className="size-10 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                    aria-label="Call tenant"
                  >
                    <IconPhone size={18} stroke={1.5} />
                  </a>
                )}
                {lease.tenantEmail && (
                  <a
                    href={`mailto:${lease.tenantEmail}`}
                    className="size-10 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                    aria-label="Email tenant"
                  >
                    <IconMail size={18} stroke={1.5} />
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* ── Lease Activity Timeline (Matching Property Detail Drawer) ── */}
          <div className="border-t border-slate-100 pt-8">
            <p className="label-caps text-slate-400 mb-5 tracking-widest">Lease Activity</p>
            {activity.length === 0 ? (
              <p className="body-sm text-slate-400">No recorded activity yet.</p>
            ) : (
              <div className="space-y-0">
                {activity.map((entry, i) => (
                  <div key={entry.id} className="flex gap-3 relative py-2.5">
                    {i < activity.length - 1 && (
                      <div className="absolute left-[7px] top-[28px] bottom-0 w-px bg-slate-100" />
                    )}
                    <div className="size-[15px] rounded-full border-2 border-slate-200 bg-white shrink-0 mt-0.5 z-10" />
                    <div className="flex-1 min-w-0">
                      <p className="body-sm text-slate-700 leading-snug">{entry.summary}</p>
                      <p className="label-caps text-slate-400 mt-1 flex items-center gap-1">
                        <IconClock size={11} stroke={2} />
                        {relativeTime(entry.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Drawer>

      <ConfirmDialog
        open={pendingTerminate}
        title="Terminate Lease Agreement"
        description={`Are you sure you want to terminate this tenancy lease for ${lease.propertyName}? This sets the lease status to inactive and changes the property occupancy status back to available immediately.`}
        confirmLabel="Terminate Lease"
        cancelLabel="Keep Active"
        tone="danger"
        isLoading={updating}
        onConfirm={confirmTerminate}
        onClose={() => setPendingTerminate(false)}
      />
    </>
  );
}
