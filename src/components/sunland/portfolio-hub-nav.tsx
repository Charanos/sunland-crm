"use client";

import Link from "next/link";
import { IconBuildingCommunity } from "@tabler/icons-react";
import { cn } from "@/lib/utils/cn";

const NAV_ITEMS = [
  { href: "/admin/properties", label: "Properties" },
  { href: "/admin/leases", label: "Leases" },
  { href: "/admin/maintenance", label: "Maintenance" },
  { href: "/admin/valuations", label: "Valuations" },
] as const;

/**
 * Shared cross-linking header for the four Property Portfolio boards
 * (Properties/Leases/Maintenance/Valuations) — was duplicated verbatim
 * across all four board files; extracted here so the nav only needs to
 * change in one place.
 */
export function PortfolioHubNav({ active }: { active: "properties" | "leases" | "maintenance" | "valuations" }) {
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

      <div className="flex bg-slate-100 p-1 rounded-xl flex-wrap gap-1">
        {NAV_ITEMS.map((item) => {
          const isActive = item.href === `/admin/${active}`;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "body-sm px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5",
                isActive ? "bg-[#151936] text-white shadow-sm" : "text-slate-500 hover:text-slate-900 hover:bg-white/45",
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
