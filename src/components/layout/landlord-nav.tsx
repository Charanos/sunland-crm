"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  IconBuildingCommunity,
  IconChevronDown,
  IconCurrencyDollar,
  IconFileText,
  IconHomeDollar,
  IconLayoutDashboard,
  IconLogout,
  IconReceiptTax,
  IconSettings,
  IconShield,
  IconUserCircle,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils/cn";

// ─── Nav structure ────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  {
    href: "/landlord",
    label: "My Portfolio",
    icon: IconLayoutDashboard,
    exact: true,
  },
  {
    href: "/landlord/properties",
    label: "Properties",
    icon: IconBuildingCommunity,
  },
  {
    href: "/landlord/remittances",
    label: "Remittance Statements",
    icon: IconCurrencyDollar,
  },
  {
    href: "/landlord/expenses",
    label: "Expense Ledger",
    icon: IconReceiptTax,
  },
  {
    href: "/landlord/mandate",
    label: "Mandate Terms",
    icon: IconFileText,
  },
];

const ACCOUNT_ITEMS = [
  { href: "/landlord/profile", label: "My Profile", icon: IconUserCircle },
  { href: "/landlord/settings", label: "Settings", icon: IconSettings },
  { href: "/landlord/security", label: "Security", icon: IconShield },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function LandlordNav() {
  const pathname = usePathname();
  const [isAccountOpen, setIsAccountOpen] = useState(false);

  const handleLogout = async () => {
    try { await fetch("/api/auth/logout", { method: "POST" }); } catch { }
    window.location.href = "/login";
  };

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[260px] flex-col border-r border-slate-200 bg-white lg:flex">
        {/* Brand */}
        <div className="shrink-0 border-b border-slate-100 px-5 py-5">
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#f3df27]/15 text-[#151936] border border-[#f3df27]/30">
              <IconHomeDollar size={20} stroke={1.75} />
            </div>
            <div>
              <p className="text-sm text-slate-900" style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 500 }}>
                Sunland ERP
              </p>
              <p className="text-xs text-slate-400">Landlord Portal</p>
            </div>
          </div>
        </div>

        {/* Portfolio badge */}
        <div className="shrink-0 px-4 py-3">
          <div className="rounded-xl bg-[#f4f6f0] px-3 py-2.5">
            <p className="label-caps text-slate-400">Active Portfolio</p>
            <p className="mt-0.5 text-base text-slate-700">Your Mandated Properties</p>
          </div>
        </div>

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto px-3 py-2 [scrollbar-width:none]">
          <div className="space-y-0.5">
            {NAV_ITEMS.map((item) => {
              const ItemIcon = item.icon;
              const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex h-10 items-center gap-3 rounded-xl px-3 text-base transition-colors",
                    isActive
                      ? "bg-[#151936] text-white"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                  )}
                >
                  <ItemIcon
                    size={17}
                    stroke={1.5}
                    aria-hidden
                    className={cn("shrink-0", isActive ? "text-[#f3df27]" : "text-slate-400")}
                  />
                  {item.label}
                </Link>
              );
            })}
          </div>

          {/* Divider */}
          <div className="my-4 h-px bg-slate-100" />

          {/* Account section */}
          <div className="space-y-0.5">
            <button
              type="button"
              onClick={() => setIsAccountOpen((v) => !v)}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-slate-400 text-base hover:bg-slate-50 hover:text-slate-700 transition-colors"
            >
              <IconUserCircle size={17} stroke={1.5} className="text-slate-400 shrink-0" />
              <span className="flex-1 text-left">Account</span>
              <IconChevronDown
                size={13}
                className={cn("text-slate-300 transition-transform", isAccountOpen && "rotate-180")}
              />
            </button>
            {isAccountOpen && (
              <div className="ml-6 space-y-0.5">
                {ACCOUNT_ITEMS.map((item) => {
                  const ItemIcon = item.icon;
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex h-9 items-center gap-2.5 rounded-lg px-3 text-base transition-colors",
                        isActive
                          ? "bg-slate-100 text-slate-900"
                          : "text-slate-400 hover:bg-slate-50 hover:text-slate-800",
                      )}
                    >
                      <ItemIcon size={15} stroke={1.5} className="shrink-0 opacity-60" aria-hidden />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </nav>

        {/* Footer */}
        <div className="shrink-0 border-t border-slate-100 p-4">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#f3df27]/20 text-[#151936] text-sm">
              LL
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-base text-slate-800">Landlord Account</p>
              <p className="truncate text-sm text-slate-400">landlord@example.com</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-base text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
          >
            <IconLogout size={14} aria-hidden />
            Sign out
          </button>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="fixed inset-x-0 top-0 z-30 flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4 lg:hidden">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-[#f3df27]/15">
            <IconHomeDollar size={18} stroke={1.75} className="text-[#151936]" />
          </div>
          <span className="text-base text-slate-900" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
            Landlord Portal
          </span>
        </div>
        <button
          type="button"
          onClick={() => setIsAccountOpen((v) => !v)}
          className="flex size-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
          aria-label="Account menu"
        >
          <IconUserCircle size={20} />
        </button>
      </div>
    </>
  );
}
