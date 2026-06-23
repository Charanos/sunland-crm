"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { IconAlertTriangle } from "@tabler/icons-react";
import {
  financeGroupById,
  financeSectionById,
  findFinanceSection,
  findFinanceTab,
} from "@/components/finance/finance-config";
import { Badge } from "@/components/ui/erp-primitives";
import { canAccess } from "@/lib/auth/roles";
import { cn } from "@/lib/utils/cn";
import type { UserRole } from "@/types";

export function FinanceModuleNav() {
  const pathname = usePathname();
  const [currentRole, setCurrentRole] = useState<UserRole>("ceo");
  const activeSection = findFinanceSection(pathname);
  const activeTab = findFinanceTab(activeSection, pathname);
  const activeGroup = financeGroupById[activeSection.groupId];
  const GroupIcon = activeGroup.icon;
  const visibleSectionIds = activeGroup.sectionIds.filter((sectionId) =>
    canAccess(currentRole, financeSectionById[sectionId].href),
  );
  const totalAttention = visibleSectionIds.reduce(
    (sum, sectionId) => sum + (financeSectionById[sectionId].attention ?? 0),
    0,
  );

  useEffect(() => {
    fetch("/api/auth/me")
      .then((response) => response.json())
      .then((data: { user?: { role?: UserRole } }) => {
        if (data.user?.role) {
          setCurrentRole(data.user.role);
        }
      })
      .catch(() => { });
  }, []);

  return (
    <section className="mb-4" aria-label="Finance control hub navigation">
      <div className="flex flex-col rounded-2xl bg-white p-3 shadow-sm animate-fade-in">
        {/* Top Row: Group Info & Section Switcher */}
        <div className="flex flex-wrap items-center justify-between gap-4 p-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-lg bg-[#151936] text-white shadow-sm">
              <GroupIcon size={18} stroke={1.7} />
            </div>
            <div className="min-w-0">
              <h2 className="truncate leading-none text-title-primary">
                {activeGroup.title}
              </h2>
              <p className="mt-1.5 truncate text-sm text-slate-500">
                {activeGroup.description}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={totalAttention > 0 ? "warning" : "success"} className="gap-1.5 py-0.5 px-2 font-medium">
              <IconAlertTriangle size={12} />
              {totalAttention} Attention
            </Badge>
            <div className="flex flex-wrap gap-1 rounded-lg bg-slate-50 border border-slate-100 p-1">
              {visibleSectionIds.map((sectionId) => {
                const section = financeSectionById[sectionId];
                const isActive = activeSection.id === section.id;
                return (
                  <Link
                    key={section.id}
                    href={section.href}
                    className={cn(
                      "inline-flex h-7 items-center gap-1.5 rounded-md px-3 text-sm  font-medium transition",
                      isActive
                        ? "bg-[#151936] text-white shadow-sm"
                        : "text-slate-500 hover:bg-slate-100 hover:text-slate-900",
                    )}
                  >
                    <span>{section.label}</span>
                    {section.attention ? (
                      <span
                        className={cn(
                          "rounded-full px-1.5 py-0.5 text-xs",
                          isActive ? "bg-[#f3df27] text-[#151936]" : "bg-slate-200 text-slate-650",
                        )}
                      >
                        {section.attention}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        {/* Bottom Row (Tabs Nav): Rendered INSIDE the card if tabs exist */}
        {activeSection.tabs.length > 0 && (
          <div className="px-2 pt-2.5 flex flex-wrap gap-1.5 bg-transparent">
            {activeSection.tabs.map((tab) => {
              const isActive = activeTab?.id === tab.id;
              return (
                <Link
                  key={tab.id}
                  href={tab.href}
                  className={cn(
                    "inline-flex px-3.5 py-1.5 text-base font-medium rounded-lg transition-all flex items-center gap-1.5",
                    isActive
                      ? "bg-[#151936] text-white shadow-sm"
                      : "text-slate-500 hover:text-slate-900 hover:bg-slate-50",
                  )}
                >
                  <span>{tab.label}</span>
                  {tab.attention ? (
                    <span
                      className={cn(
                        "rounded-full px-1.5 py-0.5 text-xs font-medium",
                        isActive ? "bg-[#f3df27] text-[#151936]" : "bg-amber-500/20 text-amber-700",
                      )}
                    >
                      {tab.attention}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
