"use client";

import { useEffect, useMemo, useState } from "react";
import {
  IconBuildingCommunity,
  IconCalendar,
  IconChevronRight,
  IconMail,
  IconMessageCircle,
  IconPhone,
  IconShieldCheck,
  IconArrowUpRight,
} from "@tabler/icons-react";
import Image from "next/image";
import Link from "next/link";
import { Drawer } from "@/components/ui/drawer";
import { useToast } from "@/components/ui/toast-provider";
import { formatCompactKES } from "@/lib/utils/format";
import { formatPropertyDate, type Property } from "./property-constants";

const PROPERTY_IMAGE_FALLBACKS = [
  "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=400&q=80",
  "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=400&q=80",
  "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=400&q=80",
  "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=400&q=80",
];

function getPropertyCover(p: Property): string {
  const primary = p.media?.find((m) => m.isPrimary)?.url ?? p.media?.[0]?.url;
  if (primary) return primary;
  const hash = parseInt(p.id.replace(/-/g, "").slice(-4), 16);
  return PROPERTY_IMAGE_FALLBACKS[hash % PROPERTY_IMAGE_FALLBACKS.length];
}

function featuredPrice(p: Property): string {
  if (p.listingType === "sale") {
    return p.askingPriceKes ? formatCompactKES(parseFloat(p.askingPriceKes)) : "On Request";
  }
  return p.monthlyRentKes ? `${formatCompactKES(parseFloat(p.monthlyRentKes))}/mo` : "On Request";
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

  const ownedProperties = useMemo(
    () => (ownerContactId ? properties.filter((p) => p.ownerContactId === ownerContactId) : []),
    [ownerContactId, properties],
  );
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
  }, [open, ownerContactId, entityId, ownedProperties]);

  if (!ownerContactId) return null;

  return (
    <Drawer open={open} onClose={onClose} title="Owner Profile" width="34rem">
      <div className="flex flex-col gap-5 pb-6">
        {/* Restored Photo Hero Card matching user preference */}
        <div className="relative h-64 rounded-3xl overflow-hidden shadow-sm flex flex-col justify-end bg-slate-900 border border-slate-100/10">
          <Image
            src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=600&auto=format&fit=crop"
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
                className="size-9 rounded-full bg-white hover:bg-slate-50 text-[#151936] flex items-center justify-center shadow-lg transition-all hover:scale-105 cursor-pointer"
              >
                <IconMessageCircle size={16} />
              </button>
              {owner?.phone && (
                <a
                  href={`tel:${owner.phone}`}
                  className="inline-flex items-center gap-2 bg-[#f3df27] text-[#151936] rounded-full px-4 py-2 body-sm hover:bg-[#e6d220] transition-all shadow-lg hover:scale-105 font-medium"
                >
                  <IconPhone size={16} /> Call
                </a>
              )}
              {owner?.email && (
                <a
                  href={`mailto:${owner.email}`}
                  className="inline-flex items-center gap-2 bg-[#151936] text-white border border-white/20 rounded-full px-4 py-2 body-sm hover:bg-[#1f2547] transition-all shadow-lg hover:scale-105 font-medium"
                >
                  <IconMail size={16} /> Mail
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Portfolio Executive 3-Stat KPI Bar */}
        <div className="bg-slate-50/80 border border-slate-200/70 rounded-2xl p-4 shadow-2xs grid grid-cols-3 divide-x divide-slate-200/80 text-center">
          <div className="px-2">
            <span className="block text-xxs font-mono font-medium text-slate-500 uppercase tracking-wider">Properties</span>
            <span className="font-mono text-2xl font-medium text-slate-900 mt-1 block">{ownedProperties.length}</span>
          </div>
          <div className="px-2">
            <span className="block text-xxs font-mono font-medium text-slate-500 uppercase tracking-wider">Active Mandates</span>
            <span className="font-mono text-2xl font-medium text-emerald-600 mt-1 block">{activeMandateCount}</span>
          </div>
          <div className="px-2">
            <span className="block text-xxs font-mono font-medium text-slate-500 uppercase tracking-wider">Collected YTD</span>
            <span className="font-mono text-lg font-medium text-[#151936] mt-1.5 block">
              {collectedYtd != null ? formatCompactKES(collectedYtd) : "—"}
            </span>
          </div>
        </div>

        {/* Fact Cells Grid — Main Info */}
        <div className="space-y-2">
          <span className="label-caps text-slate-500 px-1">Contact & Account Info</span>
          <div className="bg-slate-50/80 border border-slate-200/70 rounded-2xl p-4 shadow-2xs grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="flex items-center gap-3 min-w-0">
              <div className="size-8 rounded-lg bg-white border border-slate-200/80 flex items-center justify-center text-slate-500 shrink-0">
                <IconBuildingCommunity size={15} />
              </div>
              <div className="min-w-0">
                <span className="block text-xxs font-mono font-medium text-slate-500 uppercase tracking-wider">Company</span>
                <span className="block text-xs font-medium text-slate-900 truncate">{owner?.company || "Individual"}</span>
              </div>
            </div>

            <div className="flex items-center gap-3 min-w-0">
              <div className="size-8 rounded-lg bg-white border border-slate-200/80 flex items-center justify-center text-slate-500 shrink-0">
                <IconPhone size={15} />
              </div>
              <div className="min-w-0">
                <span className="block text-xxs font-mono font-medium text-slate-500 uppercase tracking-wider">Phone</span>
                <span className="block text-xs font-mono font-medium text-slate-900 truncate">{owner?.phone || "—"}</span>
              </div>
            </div>

            <div className="flex items-center gap-3 min-w-0">
              <div className="size-8 rounded-lg bg-white border border-slate-200/80 flex items-center justify-center text-slate-500 shrink-0">
                <IconMail size={15} />
              </div>
              <div className="min-w-0">
                <span className="block text-xxs font-mono font-medium text-slate-500 uppercase tracking-wider">Email</span>
                <span className="block text-xs font-mono font-medium text-slate-900 truncate">{owner?.email || "—"}</span>
              </div>
            </div>

            <div className="flex items-center gap-3 min-w-0">
              <div className="size-8 rounded-lg bg-white border border-slate-200/80 flex items-center justify-center text-slate-500 shrink-0">
                <IconCalendar size={15} />
              </div>
              <div className="min-w-0">
                <span className="block text-xxs font-mono font-medium text-slate-500 uppercase tracking-wider">Client Since</span>
                <span className="block text-xs font-mono font-medium text-slate-900 truncate">
                  {owner?.clientSince ? formatPropertyDate(owner.clientSince) : "—"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Owned Properties List */}
        {ownedProperties.length > 0 && (
          <div className="space-y-2 my-4">
            <div className="flex items-center justify-between px-1">
              <span className="label-caps text-slate-500">Owned Properties ({ownedProperties.length})</span>
              <span className="text-xxs font-mono text-slate-400">CLICK TO VIEW FILE</span>
            </div>
            <div className="flex flex-col gap-4">
              {ownedProperties.map((p) => {
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenProperty(p);
                    }}
                    className="flex items-center gap-3 bg-white border border-slate-200/80 rounded-2xl p-3 text-left hover:border-slate-300 hover:shadow-xs transition-all group/prop cursor-pointer"
                  >
                    <div className="relative size-12 rounded-xl overflow-hidden bg-slate-100 border border-slate-200/80 shrink-0">
                      <Image
                        src={getPropertyCover(p)}
                        alt={p.name}
                        fill
                        sizes="48px"
                        className="object-cover group-hover/prop:scale-105 transition-transform duration-300"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-slate-900 group-hover/prop:text-[#151936] transition-colors truncate">{p.name}</span>
                        <span className="font-mono text-xxs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/60 shrink-0">
                          {p.propertyCode}
                        </span>
                      </div>
                      <p className="text-caption text-slate-500 font-mono mt-0.5 truncate">
                        {p.location || "Nairobi"} · {featuredPrice(p)}
                      </p>
                    </div>
                    <IconChevronRight size={16} className="text-slate-400 group-hover/prop:text-slate-900 transition-colors shrink-0" />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Footer Trigger */}
        <Link
          href={`/admin/contacts/${ownerContactId}`}
          className="flex items-center justify-center gap-2 py-3 border border-slate-200/90 text-slate-800 hover:bg-slate-50 rounded-xl text-xs font-medium transition-all shadow-2xs mt-2"
        >
          View Full Details <IconArrowUpRight size={14} />
        </Link>
      </div>
    </Drawer>
  );
}
