"use client";

import { useEffect, useState } from "react";
import {
  IconCalendar,
  IconChevronRight,
  IconFileText,
  IconMail,
  IconMessageCircle,
  IconPhone,
  IconArrowUpRight,
  IconCash,
  IconAlertTriangle,
} from "@tabler/icons-react";
import Link from "next/link";
import Image from "next/image";
import { Drawer } from "@/components/ui/drawer";
import { Avatar } from "@/components/ui/avatar";
import { ProfileDrawerRow } from "@/components/ui/erp-primitives";
import { useToast } from "@/components/ui/toast-provider";
import { formatCompactKES } from "@/lib/utils/format";
import { formatPropertyDate } from "./property-constants";

interface TenantLease {
  id: string;
  propertyId: string;
  propertyName: string;
  propertyCode: string;
  startsAt: string | null;
  endsAt: string | null;
  monthlyRentKes: string;
  isActive: boolean;
  balanceKes: number;
}

interface TenantProfile {
  id: string;
  displayName: string;
  email: string | null;
  phone: string | null;
  companyName: string | null;
  avatarUrl: string | null;
  createdAt: string;
  leases: TenantLease[];
  balanceKes: number;
  paidYtd: number;
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export function TenantProfileDrawer({
  open,
  onClose,
  entityId,
  contactId,
}: {
  open: boolean;
  onClose: () => void;
  entityId: string;
  contactId: string | null;
}) {
  const { pushToast } = useToast();
  const [profile, setProfile] = useState<TenantProfile | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !contactId) {
      Promise.resolve().then(() => setProfile(null));
      return;
    }
    let active = true;
    setLoading(true);
    fetch(`/api/contacts/${contactId}?entityId=${entityId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active) setProfile(data?.contact ?? null);
      })
      .catch(() => {
        if (active) setProfile(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open, contactId, entityId]);

  if (!contactId) return null;

  const activeLeaseCount = profile?.leases.filter((l) => l.isActive).length ?? 0;

  const infoRows = profile
    ? [
      ...(profile.companyName ? [{ icon: IconFileText, label: "Company", value: profile.companyName }] : []),
      ...(profile.phone ? [{ icon: IconPhone, label: "Phone", value: profile.phone, mono: true }] : []),
      ...(profile.email ? [{ icon: IconMail, label: "Mail", value: profile.email }] : []),
      { icon: IconCalendar, label: "Tenant since", value: formatPropertyDate(profile.createdAt), mono: true },
    ]
    : [];

  return (
    <Drawer open={open} onClose={onClose} title="Tenant Profile" width="34rem">
      {loading || !profile ? (
        <div className="flex items-center justify-center h-64 text-slate-400 text-sm">Loading tenant profile...</div>
      ) : (
        <div className="flex flex-col gap-5">
          {/* Premium photo-hero matching the owner/manager drawer design */}
          <div className="relative h-64 rounded-3xl overflow-hidden shadow-sm flex flex-col justify-end bg-slate-900 border border-slate-100/10">
            {profile.avatarUrl ? (
              <Image src={profile.avatarUrl} alt={profile.displayName} fill className="object-cover opacity-80" />
            ) : (
              <div className="absolute inset-0 bg-tertiary-gradient flex items-center justify-center">
                <span className="text-6xl font-mono text-white/30">{initialsOf(profile.displayName)}</span>
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-[#151936]/90 via-[#151936]/40 to-transparent" />

            <div className="relative flex items-center justify-between flex-col z-10 px-6 pb-6 text-center h-full w-full">
              <div>
                <h2 className="title-serif text-white mt-8">{profile.displayName}</h2>
                <div className="flex items-center justify-center gap-1.5 text-slate-300 body-sm mb-5">
                  {profile.balanceKes > 0 ? (
                    <span className="flex items-center gap-1.5 text-rose-300">
                      <IconAlertTriangle size={14} /> {formatCompactKES(profile.balanceKes)} in arrears
                    </span>
                  ) : (
                    <>Tenant</>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => pushToast({ tone: "info", title: "Message drafted", body: "Opens the internal messaging composer." })}
                  aria-label="Message tenant"
                  className="size-9 rounded-full bg-white hover:bg-slate-50 text-[#151936] flex items-center justify-center shadow-lg transition-all hover:scale-105"
                >
                  <IconMessageCircle size={16} />
                </button>
                {profile.phone && (
                  <a
                    href={`tel:${profile.phone}`}
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
            <p className="label-caps text-slate-400 mb-3 px-1">Tenancy with Sunland</p>
            <div className="flex flex-col gap-2">
              <ProfileDrawerRow icon={IconFileText} label="Active leases" value={String(activeLeaseCount)} mono />
              <ProfileDrawerRow
                icon={IconAlertTriangle}
                label="Current balance"
                value={formatCompactKES(profile.balanceKes)}
                mono
                valueClass={profile.balanceKes > 0 ? "text-rose-600" : "text-emerald-600"}
              />
              <ProfileDrawerRow icon={IconCash} label="Paid YTD" value={formatCompactKES(profile.paidYtd)} mono />
            </div>
          </div>

          {profile.leases.length > 0 && (
            <div>
              <p className="label-caps text-slate-400 mb-2.5">Leases</p>
              <div className="flex flex-col gap-1.5">
                {profile.leases.map((l) => (
                  <Link
                    key={l.id}
                    href={`/admin/leases/${l.id}`}
                    className="flex items-center gap-3 bg-white border border-slate-100 rounded-2xl p-2.5 text-left hover:border-slate-200 hover:shadow-[0_4px_14px_rgba(0,0,0,0.05)] transition-all"
                  >
                    <span className="size-11 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                      <IconFileText size={18} />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block body-sm text-slate-900 truncate">{l.propertyName}</span>
                      <span className="block label-caps text-slate-400">
                        {l.propertyCode} · {formatCompactKES(parseFloat(l.monthlyRentKes))}/mo {l.isActive ? "" : "· ended"}
                      </span>
                    </span>
                    <IconChevronRight size={15} className="text-slate-300 shrink-0" />
                  </Link>
                ))}
              </div>
            </div>
          )}

          <Link
            href={`/admin/contacts/${profile.id}`}
            className="flex items-center justify-center gap-2 py-2.5 border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-sm font-medium transition-colors"
          >
            View Full Details <IconArrowUpRight size={14} />
          </Link>
        </div>
      )}
    </Drawer>
  );
}
