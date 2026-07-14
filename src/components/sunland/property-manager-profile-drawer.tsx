"use client";

import {
  IconBuildingCommunity,
  IconCalendar,
  IconChevronRight,
  IconMail,
  IconMessageCircle,
  IconPhone,
  IconBriefcase,
  IconStar,
  IconClock,
} from "@tabler/icons-react";
import Image from "next/image";
import { Drawer } from "@/components/ui/drawer";
import { ProfileDrawerRow } from "@/components/ui/erp-primitives";
import { useToast } from "@/components/ui/toast-provider";
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
  managerId,
  properties,
  onOpenProperty,
}: {
  open: boolean;
  onClose: () => void;
  managerId: string | null;
  properties: Property[];
  onOpenProperty: (property: Property) => void;
}) {
  const { pushToast } = useToast();

  // Mock manager data for demonstration since PropertyManager is not fully integrated in types yet
  const managerName = "Kevin Oduor";
  const managerImage = "https://images.unsplash.com/photo-1560250097-0b93528c311a?q=80&w=400&auto=format&fit=crop";
  const managerPhone = "+254 701 556 233";
  const managerEmail = "k.oduor@sunland.co.ke";
  const managerTeam = "Operations";
  const managerSince = "Feb 2024";

  // Mock performance data
  const portfolioCount = 6;
  const onTimeCollection = "94%";
  const rating = "4.8 / 5";

  // In a real app we'd filter properties by managerId
  const assignedProperties = properties.slice(0, 3); // mock assigned properties

  if (!managerId) return null;

  const infoRows: InfoRow[] = [
    { icon: IconPhone, label: "Phone", value: managerPhone, mono: true },
    { icon: IconMail, label: "Mail", value: managerEmail },
    { icon: IconBriefcase, label: "Team", value: managerTeam },
    { icon: IconCalendar, label: "Since", value: managerSince, mono: true },
  ];

  const performanceRows = [
    { icon: IconBuildingCommunity, label: "Portfolio", value: `${portfolioCount} mandates` },
    { icon: IconClock, label: "On-time collection", value: onTimeCollection, valueClass: "text-emerald-600" },
    { icon: IconStar, label: "Landlord rating", value: rating },
  ];

  return (
    <Drawer open={open} onClose={onClose} title="Property Manager" width="34rem">
      <div className="flex flex-col gap-6 bg-slate-50 min-h-full -mx-6 -my-6 p-6">
        {/* Photo-hero matching the premium design */}
        <div className="relative h-64 rounded-3xl overflow-hidden shadow-sm flex flex-col justify-end bg-slate-900 border border-slate-100/10">
          {managerImage ? (
            <Image src={managerImage} alt={managerName} fill className="object-cover opacity-80" />
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
                <IconBriefcase size={14} /> Property Manager · Sunland staff
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
              <a
                href={`tel:${managerPhone}`}
                className="inline-flex items-center gap-2 bg-[#151936] text-white border border-white/20 rounded-full px-4 py-2 body-sm hover:bg-[#1f2547] transition-all shadow-lg hover:scale-105"
              >
                <IconPhone size={16} /> Call
              </a>
            </div>
          </div>
        </div>

        <div>
          <p className="label-caps text-slate-400 mb-3 px-1">Main info</p>
          <div className="flex flex-col gap-2">
            {infoRows.map((row) => (
              <ProfileDrawerRow key={row.label} {...row} />
            ))}
          </div>
        </div>

        <div>
          <p className="label-caps text-slate-400 mb-3 px-1">Performance</p>
          <div className="flex flex-col gap-2">
            {performanceRows.map((row) => (
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
      </div>
    </Drawer>
  );
}
