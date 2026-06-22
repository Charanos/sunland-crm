"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconWallet, IconClipboardList, IconUsersGroup, IconReportAnalytics } from "@tabler/icons-react";
import { cn } from "@/lib/utils/cn";

const GROUPS = {
  ledgers: {
    title: "Ledger Control Hub",
    description: "Navigate across general and rental ledgers.",
    icon: IconWallet,
    colorClass: "bg-emerald-50 text-emerald-650",
    tabs: [
      { href: "/fin/ledger", label: "General Ledger", badge: "Core" },
      { href: "/fin/rentals", label: "Rentals Ledger", badge: "Properties" },
    ]
  },
  accounts: {
    title: "Accounts Control Hub",
    description: "Manage payables, receivables, fees, and mandates.",
    icon: IconClipboardList,
    colorClass: "bg-indigo-50 text-indigo-650",
    tabs: [
      { href: "/fin/payables", label: "Payables", badge: "Out" },
      { href: "/fin/receivables", label: "Receivables", badge: "In" },
      { href: "/fin/fees", label: "Service Fees", badge: "Ops" },
      { href: "/fin/mandates", label: "Property Mandates", badge: "Legal" },
    ]
  },
  payroll: {
    title: "Payroll Control Hub",
    description: "Manage employee compensations and benefits.",
    icon: IconUsersGroup,
    colorClass: "bg-amber-50 text-amber-650",
    tabs: [
      { href: "/fin/payroll", label: "Payroll", badge: "Active" },
    ]
  },
  reports: {
    title: "Reports Control Hub",
    description: "Financial analytics and statements.",
    icon: IconReportAnalytics,
    colorClass: "bg-sky-50 text-sky-650",
    tabs: [
      { href: "/fin/reports", label: "Financial Reports", badge: "Metrics" },
      { href: "/fin/balance-sheet", label: "Balance Sheet", badge: "Assets" },
      { href: "/fin/cash-flow", label: "Cash Flow", badge: "Liquidity" },
    ]
  }
};

export function FinanceSubNav() {
  const pathname = usePathname();

  // Determine current group
  let currentGroup = GROUPS.ledgers;
  if (pathname.includes("/payables") || pathname.includes("/receivables") || pathname.includes("/fees") || pathname.includes("/mandates")) {
    currentGroup = GROUPS.accounts;
  } else if (pathname.includes("/payroll")) {
    currentGroup = GROUPS.payroll;
  } else if (pathname.includes("/reports") || pathname.includes("/balance-sheet") || pathname.includes("/cash-flow")) {
    currentGroup = GROUPS.reports;
  }

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between flex-wrap gap-4 bg-white border border-slate-100 p-4 rounded-[20px] shadow-sm">
        <div className="flex items-center gap-2">
          <div className={cn("size-8 rounded-lg flex items-center justify-center", currentGroup.colorClass)}>
            <currentGroup.icon size={16} />
          </div>
          <div>
            <h3 className="text-base font-medium text-slate-800 leading-none">{currentGroup.title}</h3>
            <p className="text-sm text-slate-400 mt-1">{currentGroup.description}</p>
          </div>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-xl flex-wrap gap-1">
          {currentGroup.tabs.map((tab) => {
            const isActive = pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  "px-3.5 py-1.5 text-sm  font-medium rounded-lg transition-all flex items-center gap-1.5",
                  isActive
                    ? "bg-[#151936] text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-900 hover:bg-white/45"
                )}
              >
                <span>{tab.label}</span>
                <span className={cn(
                  "text-xs  px-1.5 py-0.5 rounded-full font-medium",
                  isActive ? "bg-[#f3df27] text-[#151936]" : "bg-slate-200 text-slate-600"
                )}>
                  {tab.badge}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
