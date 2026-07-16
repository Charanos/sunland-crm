"use client";

import { useEffect, useMemo, useState, type ComponentType } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  IconAlertTriangle,
  IconBriefcase,
  IconBuildingCommunity,
  IconCalendarEvent,
  IconChevronLeft,
  IconChevronRight,
  IconClock,
  IconDotsVertical,
  IconFileCertificate,
  IconFileText,
  IconHistory,
  IconLink,
  IconMail,
  IconMessageCircle,
  IconPhone,
  IconShieldCheck,
  IconWallet,
  IconWalletOff,
} from "@tabler/icons-react";
import { Card } from "@/components/ui/card";
import { DropdownMenu, DropdownItem } from "@/components/ui/dropdown-menu";
import { useToast } from "@/components/ui/toast-provider";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { formatCompactKES } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import { formatPropertyDate } from "./property-constants";

type TabKey = "overview" | "portfolio" | "documents" | "activity";
type ActionTone = "amber" | "rose" | "neutral";

interface ActionItem {
  key: string;
  tone: ActionTone;
  icon: ComponentType<{ size?: number; className?: string }>;
  title: string;
  meta: string;
  cta: string;
  onClick: () => void;
}

// Verbatim ACTION_TONE_CLASSES from mandate-full-view-board.tsx /
// property-full-view-board.tsx - kept identical rather than re-derived so
// the action band/rail read the same way across every full-view page.
const ACTION_TONE_CLASSES: Record<ActionTone, { card: string; iconWrap: string; cta: string }> = {
  amber: {
    card: "border-amber-200 bg-amber-500/[0.04] rounded-2xl p-4 flex items-center justify-between gap-4 border shadow-sm transition-all duration-300 hover:shadow-md",
    iconWrap: "bg-amber-100/80 text-amber-700 size-9 rounded-xl flex items-center justify-center shrink-0 shadow-xs",
    cta: "bg-[#f3df27] text-[#151936] font-medium text-xs rounded-xl px-4 py-1.5 hover:bg-[#e6d220] transition-colors shadow-sm whitespace-nowrap",
  },
  rose: {
    card: "border-rose-100 bg-rose-500/[0.02] rounded-2xl p-4 flex items-center justify-between gap-4 border shadow-sm transition-all duration-300 hover:shadow-md",
    iconWrap: "bg-rose-100/80 text-rose-600 size-9 rounded-xl flex items-center justify-center shrink-0 shadow-xs",
    cta: "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-medium text-xs rounded-xl px-4 py-1.5 transition-colors shadow-xs whitespace-nowrap",
  },
  neutral: {
    card: "border-slate-200/80 bg-slate-50/50 rounded-2xl p-4 flex items-center justify-between gap-4 border shadow-sm transition-all duration-300 hover:shadow-md",
    iconWrap: "bg-slate-100 text-slate-500 size-9 rounded-xl flex items-center justify-center shrink-0 shadow-xs",
    cta: "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-medium text-xs rounded-xl px-4 py-1.5 transition-colors shadow-xs whitespace-nowrap",
  },
};

type VitalTone = "emerald" | "amber" | "rose" | "neutral";
const VITAL_TONE_BG: Record<VitalTone, string> = {
  emerald: "bg-gradient-to-br from-white to-[#ecfdf5]/30 border-slate-200/80",
  amber: "bg-gradient-to-br from-white to-[#fffbeb]/45 border-slate-200/80",
  rose: "bg-gradient-to-br from-white to-[#fff1f2]/30 border-slate-200/80",
  neutral: "bg-gradient-to-br from-white to-slate-50/40 border-slate-200/80",
};
const VITAL_TONE_ICON: Record<VitalTone, string> = {
  emerald: "text-emerald-500",
  amber: "text-amber-500",
  rose: "text-rose-500",
  neutral: "text-slate-400",
};

const TYPE_LABEL: Record<string, string> = {
  landlord: "Landlord",
  tenant: "Tenant",
  buyer: "Buyer",
  seller: "Seller",
  contractor: "Contractor",
  company: "Company",
  other: "Contact",
};

interface ContactProperty {
  id: string; name: string; propertyCode: string; propertyType: string; status: string;
  monthlyRentKes: string | null; media: Array<{ url: string; alt?: string }> | null;
  managerName: string | null; managerAvatarUrl: string | null;
}
interface ContactMandate {
  id: string; propertyId: string; propertyName: string; mandateRate: string; status: string;
  startDate: string | null; endDate: string | null;
}
interface ContactRemittance {
  id: string; mandateId: string; netRemittanceKes: string; status: string; createdAt: string | null;
}
interface ContactLease {
  id: string; propertyId: string; propertyName: string; propertyCode: string;
  startsAt: string | null; endsAt: string | null; monthlyRentKes: string; depositKes: string | null;
  isActive: boolean; balanceKes: number;
}
interface ContactDocument {
  id: string; name: string; type: string; url: string; createdAt: string | null;
}
interface ContactActivity {
  id: string; summary: string; actorName: string | null; createdAt: string;
}
interface ContactProfile {
  id: string;
  type: "landlord" | "tenant" | "buyer" | "seller" | "contractor" | "company" | "other";
  displayName: string;
  companyName: string | null;
  email: string | null;
  phone: string | null;
  avatarUrl: string | null;
  idNumber: string | null;
  verifiedAt: string | null;
  createdAt: string;
  properties: ContactProperty[];
  mandates: ContactMandate[];
  remittances: ContactRemittance[];
  leases: ContactLease[];
  balanceKes: number;
  paidYtd: number;
  documents: ContactDocument[];
  activity: ContactActivity[];
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

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export function ContactFullViewBoard({ entityId, contactId }: { entityId: string | null; contactId: string }) {
  const { pushToast } = useToast();

  const [contact, setContact] = useState<ContactProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshCount, setRefreshCount] = useState(0);
  const [activeTab, setActiveTab] = useState<TabKey>("overview");

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setError(null);
    fetch(`/api/contacts/${contactId}?entityId=${entityId || ""}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        return res.json();
      })
      .then((data) => {
        if (!active) return;
        if (data.contact) setContact(data.contact);
        else setError("This contact couldn't be found.");
      })
      .catch(() => {
        if (active) setError("Couldn't load this contact. Check your connection and try again.");
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [contactId, entityId, refreshCount]);

  const isLandlord = contact?.type === "landlord";
  const isTenant = contact?.type === "tenant";

  const actionItems: ActionItem[] = useMemo(() => {
    if (!contact) return [];
    const items: ActionItem[] = [];
    if (isTenant && contact.balanceKes > 0) {
      items.push({
        key: "overdue",
        tone: "rose",
        icon: IconAlertTriangle,
        title: `${formatCompactKES(contact.balanceKes)} in arrears`,
        meta: `${contact.leases.filter((l) => l.isActive && l.balanceKes > 0).length} lease(s) affected`,
        cta: "Follow Up",
        onClick: () => setActiveTab("portfolio"),
      });
    }
    if (isLandlord) {
      const pending = contact.remittances.filter((r) => r.status === "pending");
      if (pending.length > 0) {
        items.push({
          key: "remittances",
          tone: "amber",
          icon: IconWalletOff,
          title: `${pending.length} remittance(s) pending release`,
          meta: formatCompactKES(pending.reduce((sum, r) => sum + parseFloat(r.netRemittanceKes), 0)),
          cta: "Review",
          onClick: () => setActiveTab("portfolio"),
        });
      }
      const pendingMandates = contact.mandates.filter((m) => m.status === "pending_approval");
      if (pendingMandates.length > 0) {
        items.push({
          key: "mandates",
          tone: "amber",
          icon: IconFileCertificate,
          title: `${pendingMandates.length} mandate(s) awaiting decision`,
          meta: "Activation pending approval",
          cta: "Review",
          onClick: () => setActiveTab("portfolio"),
        });
      }
    }
    if (!contact.verifiedAt) {
      items.push({
        key: "verify",
        tone: "neutral",
        icon: IconShieldCheck,
        title: "Identity not yet verified",
        meta: "No ID number confirmed on file",
        cta: "Review",
        onClick: () => setActiveTab("overview"),
      });
    }
    return items;
  }, [contact, isLandlord, isTenant]);

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error && !contact) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
        <IconAlertTriangle size={32} className="text-rose-400" aria-hidden="true" />
        <p className="text-title-primary">{error}</p>
        <button type="button" onClick={() => setRefreshCount((c) => c + 1)} className="text-sm text-[#122a20] hover:underline">
          Retry
        </button>
      </div>
    );
  }

  if (!contact) {
    return <div className="p-8 text-center text-desc-secondary">Contact not found.</div>;
  }

  const activeMandateCount = contact.mandates.filter((m) => m.status === "active").length;
  const activeLeaseCount = contact.leases.filter((l) => l.isActive).length;
  const pendingRemittanceKes = contact.remittances.filter((r) => r.status === "pending").reduce((sum, r) => sum + parseFloat(r.netRemittanceKes), 0);

  const vitals: Array<{ label: string; value: string; icon: ComponentType<{ size?: number; className?: string }>; tone: VitalTone }> = isLandlord
    ? [
      { label: "Properties Owned", value: String(contact.properties.length), icon: IconBuildingCommunity, tone: "neutral" },
      { label: "Active Mandates", value: String(activeMandateCount), icon: IconFileCertificate, tone: "emerald" },
      { label: "Pending Remittances", value: formatCompactKES(pendingRemittanceKes), icon: IconWalletOff, tone: pendingRemittanceKes > 0 ? "amber" : "neutral" },
      { label: "Documents on File", value: String(contact.documents.length), icon: IconFileText, tone: "neutral" },
    ]
    : isTenant
      ? [
        { label: "Active Leases", value: String(activeLeaseCount), icon: IconFileText, tone: "neutral" },
        { label: "Current Balance", value: formatCompactKES(contact.balanceKes), icon: IconAlertTriangle, tone: contact.balanceKes > 0 ? "rose" : "emerald" },
        { label: "Paid YTD", value: formatCompactKES(contact.paidYtd), icon: IconWallet, tone: "emerald" },
        { label: "Documents on File", value: String(contact.documents.length), icon: IconFileText, tone: "neutral" },
      ]
      : [
        { label: "Type", value: TYPE_LABEL[contact.type] ?? "Contact", icon: IconBriefcase, tone: "neutral" },
        { label: "Documents on File", value: String(contact.documents.length), icon: IconFileText, tone: "neutral" },
      ];

  const tabs: { key: TabKey; label: string; icon: ComponentType<{ size?: number; className?: string }> }[] = [
    { key: "overview", label: "Overview", icon: IconBriefcase },
    { key: "portfolio", label: isLandlord ? "Portfolio" : "Tenancy", icon: isLandlord ? IconBuildingCommunity : IconFileText },
    { key: "documents", label: "Documents", icon: IconFileText },
    { key: "activity", label: "Activity", icon: IconHistory },
  ];

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    pushToast({ tone: "success", title: "Link copied" });
  };
  const handleMessage = () => {
    pushToast({ tone: "info", title: "Message drafted", body: "Opens the internal messaging composer." });
  };

  return (
    <div className="mx-auto flex max-w-[98rem] flex-col gap-6 pb-12">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-2">
        <Link href="/admin/contacts" className="text-slate-400 hover:text-slate-600 transition-colors" aria-label="Back to Directory">
          <IconChevronLeft size={20} stroke={2} />
        </Link>
        <Link href="/" className="text-desc-secondary hover:text-slate-800">Dashboard</Link>
        <span className="text-slate-300">/</span>
        <Link href="/admin/contacts" className="text-desc-secondary hover:text-slate-800">Directory & Relationships</Link>
        <span className="text-slate-300">/</span>
        <span className="text-meta-muted-strong font-mono">{contact.id.slice(0, 8).toUpperCase()}</span>
      </div>

      {/* Command Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 px-1">
        <div className="flex flex-col gap-2.5 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-3xl lg:text-4xl font-serif tracking-tight text-slate-950 truncate">{contact.displayName}</h1>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-slate-100 px-3 py-1 text-xs font-medium uppercase tracking-wider text-slate-600">
              {TYPE_LABEL[contact.type] ?? "Contact"}
            </span>
            {contact.verifiedAt && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-100 px-3 py-1 text-xs font-medium uppercase tracking-wider text-emerald-700">
                <IconShieldCheck size={12} /> Verified
              </span>
            )}
          </div>
          {(contact.email || contact.phone || contact.companyName) && (
            <div className="flex items-center gap-3 text-slate-500 text-sm min-w-0 flex-wrap">
              {contact.companyName && <span className="font-medium truncate">{contact.companyName}</span>}
              {contact.phone && <span className="mono-data text-slate-500 shrink-0">{contact.phone}</span>}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap mt-1 sm:mt-0">
          <button
            type="button"
            onClick={handleMessage}
            className="bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 border border-slate-200/80 font-medium text-sm rounded-full px-4 py-2 shadow-xs transition-colors flex items-center gap-1.5"
          >
            <IconMessageCircle size={14} /> Message
          </button>
          <DropdownMenu
            label="More actions"
            align="right"
            trigger={
              <div className="inline-flex size-[38px] items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-xs cursor-pointer">
                <IconDotsVertical size={16} />
              </div>
            }
          >
            <DropdownItem icon={IconLink} onClick={handleCopyLink}>Copy deep link</DropdownItem>
          </DropdownMenu>
        </div>
      </div>

      {/* Bento hero: portrait + vitals */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-4 lg:gap-5 items-start">
        <div className="relative rounded-[24px] lg:rounded-[32px] overflow-hidden min-h-[280px] lg:min-h-[340px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] bg-slate-900">
          {contact.avatarUrl ? (
            <Image src={contact.avatarUrl} alt={contact.displayName} fill sizes="(max-width: 1024px) 100vw, 60vw" className="object-cover opacity-80" />
          ) : (
            <div className="absolute inset-0 bg-tertiary-gradient flex items-center justify-center">
              <span className="text-8xl font-mono text-white/20">{initialsOf(contact.displayName)}</span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#151936]/90 via-[#151936]/20 to-transparent" />
          <div className="absolute bottom-6 left-6 right-6 flex items-center gap-3">
            {contact.phone && (
              <a href={`tel:${contact.phone}`} className="inline-flex items-center gap-2 bg-[#f3df27] text-[#151936] rounded-full px-4 py-2 body-sm hover:bg-[#e6d220] transition-all shadow-lg">
                <IconPhone size={16} /> Call
              </a>
            )}
            {contact.email && (
              <a href={`mailto:${contact.email}`} className="inline-flex items-center gap-2 bg-white/95 text-[#151936] rounded-full px-4 py-2 body-sm hover:bg-white transition-all shadow-lg">
                <IconMail size={16} /> Email
              </a>
            )}
          </div>
        </div>

        <div className="flex flex-col">
          <div className="flex items-center justify-between mb-3.5 px-1">
            <p className="text-sm font-medium text-slate-800">Vital signs</p>
          </div>
          <div className="grid grid-cols-2 gap-3.5">
            {vitals.map((v) => (
              <div key={v.label} className={cn("relative overflow-hidden rounded-2xl border p-5 flex flex-col justify-between shadow-sm hover:shadow-md transition-all duration-300 h-[140px]", VITAL_TONE_BG[v.tone])}>
                <v.icon size={18} className={VITAL_TONE_ICON[v.tone]} aria-hidden="true" />
                <div>
                  <p className="label-caps text-slate-400">{v.label}</p>
                  <p className="mono-stat text-xl text-slate-900 mt-1">{v.value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Action-required band */}
      {actionItems.length > 0 && (
        <div className={cn("grid gap-3.5 mt-1", actionItems.length > 1 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1")}>
          {actionItems.map((item) => {
            const t = ACTION_TONE_CLASSES[item.tone];
            return (
              <div key={item.key} className={t.card}>
                <div className="flex items-start gap-3 min-w-0">
                  <span className={t.iconWrap}><item.icon size={18} /></span>
                  <div className="min-w-0">
                    <p className="font-sans text-sm font-medium text-slate-950 truncate leading-snug">{item.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5 truncate font-medium">{item.meta}</p>
                  </div>
                </div>
                <button type="button" onClick={item.onClick} className={t.cta}>{item.cta}</button>
              </div>
            );
          })}
        </div>
      )}

      <div className="h-px bg-slate-200/60 my-2 lg:my-4" />

      {/* Main: tabbed content + context rail */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 lg:gap-8 items-start">
        <div className="flex flex-col min-w-0">
          <div role="tablist" aria-label="Contact sections" className="flex bg-white border border-slate-100 p-1.5 rounded-[16px] shadow-[0_2px_10px_rgb(0,0,0,0.02)] gap-1 overflow-x-auto flex-nowrap mb-6">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                role="tab"
                aria-selected={activeTab === tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "body-sm px-4 py-2 rounded-xl transition-all duration-300 flex items-center gap-2 shrink-0 whitespace-nowrap font-medium",
                  activeTab === tab.key ? "bg-[#151936] text-white shadow-md" : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                )}
              >
                <tab.icon size={15} aria-hidden="true" />
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === "overview" && (
            <Card className="bg-white border border-slate-100 rounded-[24px] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
              <h3 className="text-title-primary mb-5">Contact Details</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="flex flex-col gap-1.5 p-4 rounded-xl bg-slate-50 border border-slate-100">
                  <p className="label-caps text-slate-400">Type</p>
                  <p className="mono-amount text-slate-900">{TYPE_LABEL[contact.type] ?? "Contact"}</p>
                </div>
                <div className="flex flex-col gap-1.5 p-4 rounded-xl bg-slate-50 border border-slate-100">
                  <p className="label-caps text-slate-400">ID Number</p>
                  <p className="mono-amount text-slate-900">{contact.idNumber || "Not on file"}</p>
                </div>
                <div className="flex flex-col gap-1.5 p-4 rounded-xl bg-slate-50 border border-slate-100">
                  <p className="label-caps text-slate-400">Verified</p>
                  <p className="mono-amount text-slate-900">{contact.verifiedAt ? formatPropertyDate(contact.verifiedAt) : "Not verified"}</p>
                </div>
                <div className="flex flex-col gap-1.5 p-4 rounded-xl bg-slate-50 border border-slate-100">
                  <p className="label-caps text-slate-400">On file since</p>
                  <p className="mono-amount text-slate-900">{formatPropertyDate(contact.createdAt)}</p>
                </div>
              </div>
            </Card>
          )}

          {activeTab === "portfolio" && isLandlord && (
            <div className="flex flex-col gap-4">
              <Card className="bg-white border border-slate-100 rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
                <div className="p-6 pb-3"><h3 className="text-title-primary">Properties</h3></div>
                {contact.properties.length === 0 ? (
                  <div className="p-10 text-center text-slate-400">No properties on record for this landlord.</div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {contact.properties.map((p) => (
                      <Link key={p.id} href={`/admin/properties/${p.id}`} className="flex items-center justify-between w-full px-6 py-4 hover:bg-slate-50/60 transition-colors text-left">
                        <div className="min-w-0">
                          <p className="body-md text-slate-800 font-medium truncate">{p.name}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{p.propertyCode} · {p.managerName ? `Managed by ${p.managerName}` : "Unassigned manager"}</p>
                        </div>
                        <span className="mono-stat text-slate-900 shrink-0">{p.monthlyRentKes ? `${formatCompactKES(parseFloat(p.monthlyRentKes))}/mo` : "—"}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </Card>

              <Card className="bg-white border border-slate-100 rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
                <div className="p-6 pb-3"><h3 className="text-title-primary">Management Mandates</h3></div>
                {contact.mandates.length === 0 ? (
                  <div className="p-10 text-center text-slate-400">No mandates on record.</div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {contact.mandates.map((m) => (
                      <Link key={m.id} href={`/admin/mandates/${m.id}`} className="flex items-center justify-between w-full px-6 py-4 hover:bg-slate-50/60 transition-colors text-left">
                        <div className="min-w-0">
                          <p className="body-md text-slate-800 font-medium truncate">{m.propertyName}</p>
                          <p className="text-xs text-slate-400 mt-0.5 capitalize">{m.status.replace("_", " ")} · {(parseFloat(m.mandateRate) * 100).toFixed(1)}% fee</p>
                        </div>
                        <IconChevronRight size={16} className="text-slate-300 shrink-0" />
                      </Link>
                    ))}
                  </div>
                )}
              </Card>

              <Card className="bg-white border border-slate-100 rounded-[24px] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                <h3 className="text-title-primary mb-4">Remittance History</h3>
                {contact.remittances.length === 0 ? (
                  <p className="text-slate-400 text-center py-8 text-sm bg-slate-50 rounded-2xl border border-slate-100 border-dashed">No remittance advices generated yet.</p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {contact.remittances.map((r) => (
                      <div key={r.id} className="flex items-center justify-between w-full py-3.5">
                        <div>
                          <p className="body-sm text-slate-800 font-medium">{r.createdAt ? formatPropertyDate(r.createdAt) : "—"}</p>
                          <p className="text-xs text-slate-400 mt-0.5 capitalize">{r.status}</p>
                        </div>
                        <span className="mono-stat text-slate-900">{formatCompactKES(parseFloat(r.netRemittanceKes))}</span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          )}

          {activeTab === "portfolio" && isTenant && (
            <div className="flex flex-col gap-4">
              {contact.balanceKes > 0 && (
                <div className="flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50/60 px-4 py-3">
                  <IconAlertTriangle size={18} className="text-rose-500 shrink-0" aria-hidden="true" />
                  <p className="text-body-regular text-rose-700">{formatCompactKES(contact.balanceKes)} outstanding this month</p>
                </div>
              )}
              <Card className="bg-white border border-slate-100 rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
                <div className="p-6 pb-3"><h3 className="text-title-primary">Leases</h3></div>
                {contact.leases.length === 0 ? (
                  <div className="p-10 text-center text-slate-400">No leases on record for this tenant.</div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {contact.leases.map((l) => (
                      <Link key={l.id} href={`/admin/leases/${l.id}`} className="flex items-center justify-between w-full px-6 py-4 hover:bg-slate-50/60 transition-colors text-left">
                        <div className="min-w-0">
                          <p className="body-md text-slate-800 font-medium truncate">{l.propertyName}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{l.propertyCode} · {l.isActive ? "Active" : "Ended"}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="mono-stat text-slate-900 block">{formatCompactKES(parseFloat(l.monthlyRentKes))}/mo</span>
                          {l.balanceKes > 0 && <span className="text-xs text-rose-600 font-medium">{formatCompactKES(l.balanceKes)} due</span>}
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          )}

          {activeTab === "portfolio" && !isLandlord && !isTenant && (
            <Card className="bg-white border border-slate-100 rounded-[24px] p-10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] text-center text-slate-400">
              No portfolio data tracked for this contact type.
            </Card>
          )}

          {activeTab === "documents" && (
            <div className="flex flex-col gap-4">
              {contact.documents.length === 0 ? (
                <Card className="bg-white border border-slate-100 rounded-[24px] p-16 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col items-center text-center gap-4">
                  <IconFileText size={40} stroke={1.5} className="text-slate-300" aria-hidden="true" />
                  <h3 className="text-xl font-serif text-slate-900">No documents attached</h3>
                  <p className="text-slate-400 max-w-sm text-sm">Identification, title deeds, and lease paperwork will appear here once uploaded.</p>
                </Card>
              ) : (
                <Card className="bg-white border border-slate-100 rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
                  <div className="divide-y divide-slate-100">
                    {contact.documents.map((doc) => (
                      <a key={doc.id} href={doc.url} target="_blank" rel="noreferrer" className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50/60 transition-colors">
                        <IconFileText size={16} className="text-slate-400" />
                        <span className="text-body-primary text-slate-800 truncate flex-1">{doc.name}</span>
                        <span className="label-caps text-slate-400 shrink-0">{doc.type}</span>
                      </a>
                    ))}
                  </div>
                </Card>
              )}
            </div>
          )}

          {activeTab === "activity" && (
            <Card className="bg-white border border-slate-100 rounded-[24px] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
              {contact.activity.length === 0 ? (
                <p className="text-slate-400 text-center py-12 text-sm bg-slate-50 rounded-2xl border border-slate-100 border-dashed">No recorded activity yet.</p>
              ) : (
                <div className="space-y-0 pl-2">
                  {contact.activity.map((entry, i) => (
                    <div key={entry.id} className="flex gap-4 relative py-4">
                      {i < contact.activity.length - 1 && <div className="absolute left-[9px] top-[36px] bottom-0 w-0.5 bg-slate-100 rounded-full" />}
                      <div className="size-[20px] rounded-full border-[3px] bg-white shrink-0 mt-0.5 z-10 shadow-sm border-slate-300" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 leading-snug">{entry.summary}</p>
                        <p className="text-xs uppercase tracking-wider text-slate-400 mt-1.5 flex items-center gap-1.5">
                          <IconClock size={14} stroke={2} />
                          {entry.actorName ? `${entry.actorName} · ` : ""}{relativeTime(entry.createdAt)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}
        </div>

        {/* Context rail */}
        <div className="flex flex-col gap-5">
          {actionItems.length > 0 && (
            <Card className="bg-white border border-slate-100 rounded-[24px] p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-title-primary">Needs your attention</h3>
                <span className="min-w-[24px] h-[24px] px-1.5 rounded-full bg-rose-500 text-white flex items-center justify-center mono-data text-xs shadow-sm">
                  {actionItems.length}
                </span>
              </div>
              <div className="flex flex-col gap-2.5">
                {actionItems.map((item) => {
                  const t = ACTION_TONE_CLASSES[item.tone];
                  return (
                    <div key={item.key} className={cn("flex items-center justify-between gap-3 rounded-2xl border px-3.5 py-3 shadow-sm transition-all hover:shadow-[0_4px_12px_rgb(0,0,0,0.04)]", t.card)}>
                      <div className="min-w-0">
                        <p className="body-sm text-slate-900 font-medium truncate">{item.title}</p>
                        <p className="label-caps text-slate-500 mt-0.5 truncate">{item.meta}</p>
                      </div>
                      <button type="button" onClick={item.onClick} className={cn("shrink-0 rounded-xl px-3 py-1.5 label-caps transition-colors shadow-sm", t.cta)}>
                        {item.cta}
                      </button>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          <Card className="bg-white border border-slate-100 rounded-[24px] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
            <h3 className="text-title-primary flex items-center gap-2 mb-4"><IconBriefcase size={18} className="text-slate-400" />Contact Info</h3>
            {contact.phone && (
              <a href={`tel:${contact.phone}`} className="body-sm text-slate-500 hover:text-[#122a20] flex items-center gap-2 transition-colors mt-1.5">
                <IconPhone size={14} className="shrink-0" /><span className="truncate">{contact.phone}</span>
              </a>
            )}
            {contact.email && (
              <a href={`mailto:${contact.email}`} className="body-sm text-slate-500 hover:text-[#122a20] flex items-center gap-2 transition-colors mt-1.5">
                <IconMail size={14} className="shrink-0" /><span className="truncate">{contact.email}</span>
              </a>
            )}
            {!contact.phone && !contact.email && <p className="body-sm text-slate-400">No contact details on file.</p>}
          </Card>

          <Card className="bg-white border border-slate-100 rounded-[24px] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col gap-3">
            <h3 className="label-caps text-slate-400 flex items-center gap-2"><IconCalendarEvent size={14} />Quick Facts</h3>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Reference</span>
              <span className="mono-data text-slate-700">{contact.id.slice(0, 8).toUpperCase()}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">On file since</span>
              <span className="mono-data text-slate-700">{formatPropertyDate(contact.createdAt)}</span>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
