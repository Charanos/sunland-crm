"use client";

import Link from "next/link";
import { IconBuildingCommunity } from "@tabler/icons-react";
import { cn } from "@/lib/utils/cn";

const NAV_ITEMS = [
  { href: "/admin/properties", label: "Properties", key: "properties" },
  { href: "/admin/leases", label: "Leases", key: "leases" },
  { href: "/admin/maintenance", label: "Maintenance", key: "maintenance" },
  { href: "/admin/valuations", label: "Valuations", key: "valuations" },
] as const;

export type HubTabKey = "properties" | "leases" | "maintenance" | "valuations";

/**
 * Shared cross-linking header for the four Property Portfolio boards
 * (Properties/Leases/Maintenance/Valuations) - was duplicated verbatim
 * across all four board files; extracted here so the nav only needs to
 * change in one place.
 */
export function PortfolioHubNav({
  active,
  mode,
  onModeChange,
}: {
  active: HubTabKey;
  mode?: "mandates" | "leases";
  onModeChange?: (mode: "mandates" | "leases") => void;
}) {
  return (
    <div className="flex items-center justify-between flex-wrap gap-4 bg-white border border-slate-100 p-4 rounded-[20px] shadow-sm">
      <div className="flex items-center gap-2">
        <div className="size-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
          <IconBuildingCommunity size={20} />
        </div>
        <div>
          <h3 className="text-title-primary">Property Portfolio Hub</h3>
          <p className="text-desc-secondary mt-1">Manage property inventory, tenancies, maintenance requests, and valuations.</p>
        </div>
      </div>

      <div className="flex bg-slate-100 p-1 rounded-xl flex-wrap gap-1 items-center">
        {NAV_ITEMS.map((item) => {
          const isActive = item.key === active;

          if (item.key === "leases" && isActive && mode && onModeChange) {
            return (
              <div
                key={item.key}
                className="flex items-center bg-[#151936] p-1 rounded-[12px] shadow-md ring-1 ring-slate-900/5 transition-all duration-500 overflow-hidden"
              >
                <div className="flex items-center pl-3 pr-2 gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                  <span className="text-[10px] font-medium text-slate-300 uppercase tracking-widest">Leases</span>
                </div>

                <div className="w-px h-4 bg-white/10 mx-1" />

                <div className="flex items-center gap-0.5">
                  <button
                    onClick={() => onModeChange("mandates")}
                    className={cn(
                      "body-sm px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5",
                      mode === "mandates"
                        ? "bg-white/15 text-white shadow-sm"
                        : "text-slate-400 hover:text-white hover:bg-white/5"
                    )}
                  >
                    Mandates
                  </button>
                  <button
                    onClick={() => onModeChange("leases")}
                    className={cn(
                      "body-sm px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5",
                      mode === "leases"
                        ? "bg-white/15 text-white shadow-sm"
                        : "text-slate-400 hover:text-white hover:bg-white/5"
                    )}
                  >
                    Tenants
                  </button>
                </div>
              </div>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "body-sm px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5",
                isActive ? "bg-[#151936] text-white shadow-sm" : "text-slate-400 hover:text-slate-900 hover:bg-white/45",
              )}
            >
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
