"use client";

import { useEffect, useState } from "react";
import {
  IconBuildingCommunity,
  IconCalendar,
  IconChevronRight,
  IconFileCertificate,
  IconMail,
  IconMessageCircle,
  IconPhone,
  IconShieldCheck,
  IconCash,
  IconIdBadge2,
} from "@tabler/icons-react";
import Image from "next/image";
import { Drawer } from "@/components/ui/drawer";
import { ProfileDrawerRow } from "@/components/ui/erp-primitives";
import { useToast } from "@/components/ui/toast-provider";
import { formatCompactKES } from "@/lib/utils/format";
import { PROPERTY_TYPE_ICON, formatPropertyDate, type Property } from "./property-constants";

function featuredPrice(p: Property): string {
  if (p.listingType === "sale") {
    return p.askingPriceKes ? formatCompactKES(parseFloat(p.askingPriceKes)) : "On Request";
  }
  return p.monthlyRentKes ? `${formatCompactKES(parseFloat(p.monthlyRentKes))}/mo` : "On Request";
}

interface InfoRow {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: string;
  mono?: boolean;
}

export function PropertyOwnerProfileDrawer({
  open,
  onClose,
  entityId,
  ownerContactId,
  properties,
  onOpenProperty,
}: {
  open: boolean;
  onClose: () => void;
  entityId: string;
  ownerContactId: string | null;
  properties: Property[];
  onOpenProperty: (property: Property) => void;
}) {
  const { pushToast } = useToast();
  const [collectedYtd, setCollectedYtd] = useState<number | null>(null);

  const ownedProperties = ownerContactId ? properties.filter((p) => p.ownerContactId === ownerContactId) : [];
  const owner = ownedProperties[0]?.owner ?? null;
  const ownerName = owner?.name || ownedProperties[0]?.ownerName || "Unassigned owner";
  const activeMandateCount = ownedProperties.filter((p) => p.mandateStatus === "active").length;

  useEffect(() => {
    if (!open || !ownerContactId) {
      Promise.resolve().then(() => setCollectedYtd(null));
      return;
    }
    let active = true;
    const propertyIds = new Set(ownedProperties.map((p) => p.id));
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
  }, [open, ownerContactId, entityId]);

  if (!ownerContactId) return null;

  const infoRows: InfoRow[] = [
    ...(owner?.company ? [{ icon: IconBuildingCommunity, label: "Company", value: owner.company }] : []),
    ...(owner?.phone ? [{ icon: IconPhone, label: "Phone", value: owner.phone, mono: true }] : []),
    ...(owner?.email ? [{ icon: IconMail, label: "Mail", value: owner.email }] : []),
    ...(owner?.idNumber ? [{ icon: IconIdBadge2, label: "ID Number", value: owner.idNumber, mono: true }] : []),
    ...(owner?.clientSince
      ? [{ icon: IconCalendar, label: "Client since", value: formatPropertyDate(owner.clientSince), mono: true }]
      : []),
  ];

  const statRows: InfoRow[] = [
    { icon: IconBuildingCommunity, label: "Properties", value: String(ownedProperties.length), mono: true },
    { icon: IconFileCertificate, label: "Active mandates", value: String(activeMandateCount), mono: true },
    { icon: IconCash, label: "Collected YTD", value: collectedYtd != null ? formatCompactKES(collectedYtd) : "-", mono: true },
  ];

  return (
    <Drawer open={open} onClose={onClose} title="Owner Profile" width="34rem">
      <div className="flex flex-col gap-5">
        {/* Premium photo-hero matching the property manager design */}
        <div className="relative h-64 rounded-3xl overflow-hidden shadow-sm flex flex-col justify-end bg-slate-900 border border-slate-100/10">
          <Image
            src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=400&auto=format&fit=crop"
            alt={ownerName}
            fill
            className="object-cover opacity-80"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#151936]/90 via-[#151936]/40 to-transparent" />

          <div className="relative flex items-center justify-between flex-col z-10 px-6 pb-6 text-center h-full w-full">
            <div>
              <h2 className="title-serif text-white mt-8">{ownerName}</h2>
              {owner?.verifiedAt ? (
                <div className="flex items-center justify-center gap-1.5 text-emerald-300 body-sm mb-5">
                  <IconShieldCheck size={14} /> Verified landlord
                </div>
              ) : (
                <div className="flex items-center justify-center gap-1.5 text-slate-300 body-sm mb-5">
                  <IconBuildingCommunity size={14} /> Landlord
                </div>
              )}
            </div>

            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => pushToast({ tone: "info", title: "Message drafted", body: "Opens the internal messaging composer." })}
                aria-label="Message owner"
                className="size-9 rounded-full bg-white hover:bg-slate-50 text-[#151936] flex items-center justify-center shadow-lg transition-all hover:scale-105"
              >
                <IconMessageCircle size={16} />
              </button>
              {owner?.phone && (
                <a
                  href={`tel:${owner.phone}`}
                  className="inline-flex items-center gap-2 bg-[#f3df27] text-[#151936] rounded-full px-4 py-2 body-sm hover:bg-[#e6d220] transition-all shadow-lg hover:scale-105"
                >
                  <IconPhone size={16} /> Call
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
          <p className="label-caps text-slate-400 mb-3 px-1">Portfolio with Sunland</p>
          <div className="flex flex-col gap-2">
            {statRows.map((row) => (
              <ProfileDrawerRow key={row.label} {...row} />
            ))}
          </div>
        </div>

        {ownedProperties.length > 0 && (
          <div>
            <p className="label-caps text-slate-400 mb-2.5">Properties</p>
            <div className="flex flex-col gap-1.5">
              {ownedProperties.map((p) => {
                const TypeIcon = (PROPERTY_TYPE_ICON as Record<string, React.ElementType>)[p.propertyType] ?? IconBuildingCommunity;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenProperty(p);
                    }}
                    className="flex items-center gap-3 bg-white border border-slate-100 rounded-2xl p-2.5 text-left hover:border-slate-200 hover:shadow-[0_4px_14px_rgba(0,0,0,0.05)] transition-all"
                  >
                    <span className="size-11 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                      <TypeIcon size={18} />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block body-sm text-slate-900 truncate">{p.name}</span>
                      <span className="block label-caps text-slate-400">{p.propertyCode} · {featuredPrice(p)}</span>
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
