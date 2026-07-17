"use client";

import { useEffect, useState, type ComponentType } from "react";
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
  IconHistory,
  IconLink,
  IconMail,
  IconMessageCircle,
  IconWallet,
} from "@tabler/icons-react";
import { Card } from "@/components/ui/card";
import { DropdownMenu, DropdownItem } from "@/components/ui/dropdown-menu";
import { useToast } from "@/components/ui/toast-provider";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { formatCompactKES } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import { formatPropertyDate } from "./property-constants";

type TabKey = "overview" | "properties" | "activity";
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

interface ManagerMandate {
  id: string; propertyId: string; propertyName: string; propertyCode: string;
  mandateRate: string; status: string; startDate: string | null;
}
interface ManagerActivity {
  id: string; summary: string; actorName: string | null; createdAt: string;
}
interface ManagerProfile {
  id: string;
  name: string;
  email: string;
  title: string | null;
  avatarUrl: string | null;
  role: string;
  createdAt: string;
  mandates: ManagerMandate[];
  activeMandateCount: number;
  collectedYtd: number;
  activity: ManagerActivity[];
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

export function ManagerFullViewBoard({ entityId, managerId }: { entityId: string | null; managerId: string }) {
  const { pushToast } = useToast();

  const [manager, setManager] = useState<ManagerProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshCount, setRefreshCount] = useState(0);
  const [activeTab, setActiveTab] = useState<TabKey>("overview");

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active) {
        setIsLoading(true);
        setError(null);
      }
    });
    fetch(`/api/identity/users/${managerId}/profile?entityId=${entityId || ""}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        return res.json();
      })
      .then((data) => {
        if (!active) return;
        if (data.manager) setManager(data.manager);
        else setError("This team member couldn't be found.");
      })
      .catch(() => {
        if (active) setError("Couldn't load this profile. Check your connection and try again.");
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [managerId, entityId, refreshCount]);

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error && !manager) {
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

  if (!manager) {
    return <div className="p-8 text-center text-desc-secondary">Team member not found.</div>;
  }

  const vitals: Array<{ label: string; value: string; icon: ComponentType<{ size?: number; className?: string }>; tone: VitalTone }> = [
    { label: "Active Mandates", value: String(manager.activeMandateCount), icon: IconFileCertificate, tone: "emerald" },
    { label: "Total Assigned", value: String(manager.mandates.length), icon: IconBuildingCommunity, tone: "neutral" },
    { label: "Collected YTD", value: formatCompactKES(manager.collectedYtd), icon: IconWallet, tone: "emerald" },
    { label: "Role", value: manager.title || "Property Manager", icon: IconBriefcase, tone: "neutral" },
  ];

  const tabs: { key: TabKey; label: string; icon: ComponentType<{ size?: number; className?: string }> }[] = [
    { key: "overview", label: "Overview", icon: IconBriefcase },
    { key: "properties", label: "Assigned Properties", icon: IconBuildingCommunity },
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
        <Link href="/admin/leases" className="text-slate-400 hover:text-slate-600 transition-colors" aria-label="Back">
          <IconChevronLeft size={20} stroke={2} />
        </Link>
        <Link href="/" className="text-desc-secondary hover:text-slate-800">Dashboard</Link>
        <span className="text-slate-300">/</span>
        <span className="text-desc-secondary">Team</span>
        <span className="text-slate-300">/</span>
        <span className="text-meta-muted-strong font-mono">{manager.id.slice(0, 8).toUpperCase()}</span>
      </div>

      {/* Command Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 px-1">
        <div className="flex flex-col gap-2.5 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-3xl lg:text-4xl font-serif tracking-tight text-slate-950 truncate">{manager.name}</h1>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-slate-100 px-3 py-1 text-xs font-medium uppercase tracking-wider text-slate-600">
              {manager.title || "Property Manager"}
            </span>
          </div>
          <div className="flex items-center gap-3 text-slate-500 text-sm min-w-0">
            <span className="mono-data text-slate-500 shrink-0">{manager.email}</span>
          </div>
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
          {manager.avatarUrl ? (
            <Image src={manager.avatarUrl} alt={manager.name} fill sizes="(max-width: 1024px) 100vw, 60vw" className="object-cover opacity-80" />
          ) : (
            <div className="absolute inset-0 bg-tertiary-gradient flex items-center justify-center">
              <span className="text-8xl font-mono text-white/20">{initialsOf(manager.name)}</span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#151936]/90 via-[#151936]/20 to-transparent" />
          <div className="absolute bottom-6 left-6 right-6 flex items-center gap-3">
            <a href={`mailto:${manager.email}`} className="inline-flex items-center gap-2 bg-white/95 text-[#151936] rounded-full px-4 py-2 body-sm hover:bg-white transition-all shadow-lg">
              <IconMail size={16} /> Email
            </a>
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

      <div className="h-px bg-slate-200/60 my-2 lg:my-4" />

      {/* Main: tabbed content + context rail */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 lg:gap-8 items-start">
        <div className="flex flex-col min-w-0">
          <div role="tablist" aria-label="Team member sections" className="flex bg-white border border-slate-100 p-1.5 rounded-[16px] shadow-[0_2px_10px_rgb(0,0,0,0.02)] gap-1 overflow-x-auto flex-nowrap mb-6">
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
              <h3 className="text-title-primary mb-5">Staff Details</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="flex flex-col gap-1.5 p-4 rounded-xl bg-slate-50 border border-slate-100">
                  <p className="label-caps text-slate-400">Role</p>
                  <p className="mono-amount text-slate-900">{manager.title || "Property Manager"}</p>
                </div>
                <div className="flex flex-col gap-1.5 p-4 rounded-xl bg-slate-50 border border-slate-100">
                  <p className="label-caps text-slate-400">Active Mandates</p>
                  <p className="mono-amount text-slate-900">{manager.activeMandateCount}</p>
                </div>
                <div className="flex flex-col gap-1.5 p-4 rounded-xl bg-slate-50 border border-slate-100">
                  <p className="label-caps text-slate-400">Collected YTD</p>
                  <p className="mono-amount text-slate-900">{formatCompactKES(manager.collectedYtd)}</p>
                </div>
                <div className="flex flex-col gap-1.5 p-4 rounded-xl bg-slate-50 border border-slate-100">
                  <p className="label-caps text-slate-400">Staff since</p>
                  <p className="mono-amount text-slate-900">{formatPropertyDate(manager.createdAt)}</p>
                </div>
              </div>
            </Card>
          )}

          {activeTab === "properties" && (
            <Card className="bg-white border border-slate-100 rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
              {manager.mandates.length === 0 ? (
                <div className="p-10 text-center text-slate-400">No properties currently assigned.</div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {manager.mandates.map((m) => (
                    <Link key={m.id} href={`/admin/mandates/${m.id}`} className="flex items-center justify-between w-full px-6 py-4 hover:bg-slate-50/60 transition-colors text-left">
                      <div className="min-w-0">
                        <p className="body-md text-slate-800 font-medium truncate">{m.propertyName}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{m.propertyCode} · {(parseFloat(m.mandateRate) * 100).toFixed(1)}% fee · <span className="capitalize">{m.status.replace("_", " ")}</span></p>
                      </div>
                      <IconChevronRight size={16} className="text-slate-300 shrink-0" />
                    </Link>
                  ))}
                </div>
              )}
            </Card>
          )}

          {activeTab === "activity" && (
            <Card className="bg-white border border-slate-100 rounded-[24px] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
              {manager.activity.length === 0 ? (
                <p className="text-slate-400 text-center py-12 text-sm bg-slate-50 rounded-2xl border border-slate-100 border-dashed">No recorded activity yet.</p>
              ) : (
                <div className="space-y-0 pl-2">
                  {manager.activity.map((entry, i) => (
                    <div key={entry.id} className="flex gap-4 relative py-4">
                      {i < manager.activity.length - 1 && <div className="absolute left-[9px] top-[36px] bottom-0 w-0.5 bg-slate-100 rounded-full" />}
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
          <Card className="bg-white border border-slate-100 rounded-[24px] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
            <h3 className="text-title-primary flex items-center gap-2 mb-4"><IconBriefcase size={18} className="text-slate-400" />Contact Info</h3>
            <a href={`mailto:${manager.email}`} className="body-sm text-slate-500 hover:text-[#122a20] flex items-center gap-2 transition-colors mt-1.5">
              <IconMail size={14} className="shrink-0" /><span className="truncate">{manager.email}</span>
            </a>
          </Card>

          <Card className="bg-white border border-slate-100 rounded-[24px] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col gap-3">
            <h3 className="label-caps text-slate-400 flex items-center gap-2"><IconCalendarEvent size={14} />Quick Facts</h3>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Reference</span>
              <span className="mono-data text-slate-700">{manager.id.slice(0, 8).toUpperCase()}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Staff since</span>
              <span className="mono-data text-slate-700">{formatPropertyDate(manager.createdAt)}</span>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
