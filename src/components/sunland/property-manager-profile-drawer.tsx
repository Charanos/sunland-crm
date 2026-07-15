"use client";

import { useEffect, useState } from "react";
import {
  IconBuildingCommunity,
  IconChevronRight,
  IconMail,
  IconMessageCircle,
  IconBriefcase,
  IconCash,
  IconArrowUpRight,
} from "@tabler/icons-react";
import Image from "next/image";
import Link from "next/link";
import { Drawer } from "@/components/ui/drawer";
import { ProfileDrawerRow } from "@/components/ui/erp-primitives";
import { useToast } from "@/components/ui/toast-provider";
import { formatCompactKES } from "@/lib/utils/format";
import { PROPERTY_TYPE_ICON, type Property } from "./property-constants";

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

interface InfoRow {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: string;
  mono?: boolean;
}

export function PropertyManagerProfileDrawer({
  open,
  onClose,
  entityId,
  managerId,
  properties,
  onOpenProperty,
}: {
  open: boolean;
  onClose: () => void;
  entityId: string;
  managerId: string | null;
  properties: Property[];
  onOpenProperty: (property: Property) => void;
}) {
  const { pushToast } = useToast();
  const [collectedYtd, setCollectedYtd] = useState<number | null>(null);

  const assignedProperties = managerId ? properties.filter((p) => p.manager?.id === managerId) : [];
  const manager = assignedProperties[0]?.manager ?? null;
  const managerName = manager?.name || "Property Manager";

  useEffect(() => {
    if (!open || !managerId) {
      Promise.resolve().then(() => setCollectedYtd(null));
      return;
    }
    let active = true;
    const propertyIds = new Set(assignedProperties.map((p) => p.id));
    const yearStart = new Date(new Date().getFullYear(), 0, 1).getTime();
    fetch(`/api/finance/transactions?entityId=${entityId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active || !data) return;
        const sum = (data.transactions ?? [])
          .filter(
            (t: { type: string; propertyId: string | null; occurredAt: string; amountKes: string }) =>
              t.type === "rent" && t.propertyId && propertyIds.has(t.propertyId) && new Date(t.occurredAt).getTime() >= yearStart
          )
          .reduce((acc: number, t: { amountKes: string }) => acc + parseFloat(t.amountKes), 0);
        setCollectedYtd(sum);
      })
      .catch(() => {
        if (active) setCollectedYtd(null);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, managerId, entityId]);

  if (!managerId) return null;

  const infoRows: InfoRow[] = [
    ...(manager?.title ? [{ icon: IconBriefcase, label: "Title", value: manager.title }] : []),
    ...(manager?.email ? [{ icon: IconMail, label: "Mail", value: manager.email }] : []),
  ];

  const statRows: InfoRow[] = [
    { icon: IconBuildingCommunity, label: "Assigned properties", value: String(assignedProperties.length), mono: true },
    { icon: IconCash, label: "Collected YTD", value: collectedYtd != null ? formatCompactKES(collectedYtd) : "-", mono: true },
  ];

  return (
    <Drawer open={open} onClose={onClose} title="Property Manager" width="34rem">
      <div className="flex flex-col gap-5">
        {/* Premium photo-hero matching the owner profile design */}
        <div className="relative h-64 rounded-3xl overflow-hidden shadow-sm flex flex-col justify-end bg-slate-900 border border-slate-100/10">
          {manager?.avatarUrl ? (
            <Image src={manager.avatarUrl} alt={managerName} fill className="object-cover opacity-80" />
          ) : (
            <div className="absolute inset-0 bg-tertiary-gradient flex items-center justify-center">
              <span className="text-6xl font-mono text-white/30">{initialsOf(managerName)}</span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#151936]/90 via-[#151936]/40 to-transparent" />

          <div className="relative flex items-center justify-between flex-col z-10 px-6 pb-6 text-center h-full w-full">
            <div>
              <h2 className="title-serif text-white mt-8">{managerName}</h2>
              <div className="flex items-center justify-center gap-1.5 text-slate-300 body-sm mb-5">
                <IconBriefcase size={14} /> {manager?.title || "Property Manager"} · Sunland staff
              </div>
            </div>

            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => pushToast({ tone: "info", title: "Message drafted", body: "Opens the internal messaging composer." })}
                aria-label="Message manager"
                className="size-9 rounded-full bg-white hover:bg-slate-50 text-[#151936] flex items-center justify-center shadow-lg transition-all hover:scale-105"
              >
                <IconMessageCircle size={16} />
              </button>
              {manager?.email && (
                <a
                  href={`mailto:${manager.email}`}
                  className="inline-flex items-center gap-2 bg-[#151936] text-white border border-white/20 rounded-full px-4 py-2 body-sm hover:bg-[#1f2547] transition-all shadow-lg hover:scale-105"
                >
                  <IconMail size={16} /> Email
                </a>
              )}
            </div>
          </div>
        </div>

        {infoRows.length > 0 && (
          <div>
            <p className="label-caps text-slate-400 mb-3 px-1">Main info</p>
            <div className="flex flex-col gap-2">
              {infoRows.map((row) => (
                <ProfileDrawerRow key={row.label} {...row} />
              ))}
            </div>
          </div>
        )}

        <div>
          <p className="label-caps text-slate-400 mb-3 px-1">Portfolio</p>
          <div className="flex flex-col gap-2">
            {statRows.map((row) => (
              <ProfileDrawerRow key={row.label} {...row} />
            ))}
          </div>
        </div>

        {assignedProperties.length > 0 && (
          <div>
            <p className="label-caps text-slate-400 mb-3 px-1">Assigned properties</p>
            <div className="flex flex-col gap-2">
              {assignedProperties.map((p) => {
                const TypeIcon = (PROPERTY_TYPE_ICON as Record<string, React.ElementType>)[p.propertyType] ?? IconBuildingCommunity;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenProperty(p);
                    }}
                    className="flex items-center gap-3 bg-white border border-slate-100 rounded-2xl p-3 text-left hover:border-slate-200 hover:shadow-[0_4px_14px_rgba(0,0,0,0.03)] transition-all"
                  >
                    <span className="size-11 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                      <TypeIcon size={18} stroke={1.5} />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block body-sm text-slate-900 truncate">{p.name}</span>
                      <span className="block label-caps text-slate-400 mt-0.5">{p.propertyCode}</span>
                    </span>
                    <IconChevronRight size={15} className="text-slate-300 shrink-0" />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <Link
          href={`/admin/team/${managerId}`}
          className="flex items-center justify-center gap-2 py-2.5 border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-sm font-medium transition-colors"
        >
          View Full Details <IconArrowUpRight size={14} />
        </Link>
      </div>
    </Drawer>
  );
}
