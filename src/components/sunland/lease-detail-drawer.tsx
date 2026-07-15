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
} from "@tabler/icons-react";
import { Button, ConfirmDialog, Avatar } from "@/components/ui/erp-primitives";
import { Drawer } from "@/components/ui/drawer";
import { formatCompactKES } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
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

  const rentVal = `${formatCompactKES(parseFloat(lease.monthlyRentKes))}/mo`;
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
        width="32rem"
        footer={
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Link href={`/admin/leases/${lease.id}`} className="flex-1">
                <Button size="sm" className="w-full bg-[#151936] text-white hover:bg-[#151936]/90 h-9">
                  <IconEye size={14} />
                  Full View
                </Button>
              </Link>
              {canManage && (
                <Button variant="secondary" size="sm" onClick={() => onEdit?.(lease)} className="flex-1 h-9">
                  <IconEdit size={14} />
                  Edit
                </Button>
              )}
            </div>
            {canManage && lease.isActive && (
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" onClick={() => onRenew?.(lease)} className="flex-1 h-9">
                  <IconRefresh size={14} />
                  Renew
                </Button>
                <Button variant="danger" size="sm" onClick={() => setPendingTerminate(true)} className="flex-1 h-9 border-red-100 hover:border-red-200">
                  <IconTrash size={14} />
                  Terminate
                </Button>
              </div>
            )}
          </div>
        }
      >
        <div className="space-y-6 animate-fade-in-up">
          {/* ── Header ── */}
          <div className="relative w-full rounded-2xl overflow-hidden shadow-sm border border-[#151936] bg-tertiary-gradient p-6 text-white">
            <div className="absolute right-0 top-0 size-64 bg-white/5 rounded-full blur-3xl pointer-events-none" />
            <div className="flex flex-col items-start justify-between relative z-10">
              <div className="flex items-center justify-between w-full mb-4">
                <p className="text-white/60 label-caps font-medium">Lease ID: {lease.id.slice(0, 8).toUpperCase()}</p>
                <div className={cn(
                  "px-2.5 py-1 rounded-md border shadow-sm label-caps bg-white/10 backdrop-blur-sm",
                  lease.isActive ? "border-emerald-500/30 text-emerald-300" : "border-slate-500/30 text-slate-300"
                )}>
                  {lease.isActive ? (isExpired ? "Expired Active" : "Active") : "Terminated"}
                </div>
              </div>
              <div>
                <h3 className="text-white leading-snug">{lease.propertyName}</h3>
                <div className="flex items-center gap-1.5 mt-2 text-slate-300">
                  <IconMapPin size={13} stroke={2} />
                  <span className="body-sm">{lease.propertyLocation || "Sunland Managed Location"}</span>
                </div>
              </div>
            </div>
          </div>

          {/* ── Price & Financials ── */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[#151936] tracking-tight leading-none mono-stat text-2xl">{rentVal}</p>
              <p className="label-caps text-slate-400 mt-1.5">Expected Monthly Rent</p>
            </div>
            <div className="text-right shrink-0">
              <span className="mono-data text-slate-600 text-lg">
                {lease.depositKes ? formatCompactKES(parseFloat(lease.depositKes)) : "N/A"}
              </span>
              <p className="label-caps text-slate-400 mt-0.5">Deposit Held - refundable liability</p>
            </div>
          </div>

          {/* ── Info Tiles ── */}
          <div className="grid grid-cols-2 gap-3">
            {[
              {
                icon: IconCalendar,
                label: "Starts On",
                value: new Date(lease.startsAt).toLocaleDateString(),
              },
              {
                icon: IconCalendar,
                label: "Ends On",
                value: new Date(lease.endsAt).toLocaleDateString(),
              },
              {
                icon: PropIcon,
                label: "Unit Code",
                value: lease.propertyCode,
              },
              {
                icon: IconShield,
                label: "Tenancy Status",
                value: lease.isActive ? "Active Resident" : "Former Resident",
              },
            ].map((tile) => (
              <div
                key={tile.label}
                className="bg-slate-50/70 border border-slate-100 rounded-xl p-3.5 flex items-center gap-3 hover:bg-slate-50 transition-colors"
              >
                <div className="size-9 rounded-lg bg-white border border-slate-100 flex items-center justify-center text-slate-400 shadow-sm shrink-0">
                  <tile.icon size={16} stroke={1.5} />
                </div>
                <div>
                  <p className="mono-data text-slate-800 leading-none">{tile.value}</p>
                  <p className="label-caps text-slate-400 mt-1">{tile.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* ── Tenant Profile ── */}
          <div className="border border-slate-100 rounded-xl p-4 bg-slate-50/50">
            <p className="label-caps text-slate-400 mb-3">Principal Tenant</p>
            <div className="flex items-center gap-3">
              <Avatar
                src={(lease as any).tenantAvatarUrl || undefined}
                fallback={getInitials(lease.tenantName)}
                className="size-10 bg-white border border-slate-200 text-slate-400 shrink-0 text-[10px]"
              />
              <div className="flex-1 min-w-0">
                <p className="body-sm text-slate-800 leading-none mb-1.5 truncate font-medium">{lease.tenantName}</p>
                <p className="label-caps text-slate-400 leading-none truncate">{lease.tenantEmail || lease.tenantPhone || "No contact info"}</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {lease.tenantPhone && (
                  <a
                    href={`tel:${lease.tenantPhone}`}
                    className="size-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-[#151936] hover:border-[#151936]/30 transition-colors shadow-sm"
                    aria-label="Call tenant"
                  >
                    <IconPhone size={14} stroke={2} />
                  </a>
                )}
                {lease.tenantEmail && (
                  <a
                    href={`mailto:${lease.tenantEmail}`}
                    className="size-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-[#151936] hover:border-[#151936]/30 transition-colors shadow-sm"
                    aria-label="Email tenant"
                  >
                    <IconMail size={14} stroke={2} />
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* ── Activity Timeline ── */}
          <div>
            <p className="label-caps text-slate-400 mb-3">Lease Activity</p>
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
