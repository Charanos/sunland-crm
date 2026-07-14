"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconBell,
  IconFileText,
  IconHome,
  IconLogout,
  IconMessageCircle,
  IconReceiptDollar,
  IconSettings,
  IconTool,
  IconUserCircle,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils/cn";

// ─── Nav structure ────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { href: "/tenant", label: "Home", icon: IconHome, exact: true },
  { href: "/tenant/payments", label: "Rent & Payments", icon: IconReceiptDollar },
  { href: "/tenant/statement", label: "My Statement", icon: IconFileText },
  { href: "/tenant/lease", label: "My Lease", icon: IconFileText },
  { href: "/tenant/maintenance", label: "Maintenance", icon: IconTool, badge: "2" },
  { href: "/tenant/notice", label: "Move-Out Notice", icon: IconMessageCircle },
];

const ACCOUNT_ITEMS = [
  { href: "/tenant/profile", label: "Profile", icon: IconUserCircle },
  { href: "/tenant/settings", label: "Settings", icon: IconSettings },
  { href: "/tenant/notifications", label: "Notifications", icon: IconBell },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function TenantNav() {
  const pathname = usePathname();

  const handleLogout = async () => {
    try { await fetch("/api/auth/logout", { method: "POST" }); } catch { }
    window.location.href = "/login";
  };

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[240px] flex-col border-r border-slate-200 bg-white lg:flex">
        {/* Brand */}
        <div className="shrink-0 border-b border-slate-100 px-5 py-5">
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#151936]/8 border border-[#151936]/10">
              <IconHome size={19} stroke={1.75} className="text-[#151936]" />
            </div>
            <div>
              <p className="text-sm text-slate-900" style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 500 }}>
                Sunland ERP
              </p>
              <p className="text-xs text-slate-400">Tenant Portal</p>
            </div>
          </div>
        </div>

        {/* Rent status banner */}
        <div className="shrink-0 px-4 py-3">
          <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2.5">
            <p className="label-caps text-emerald-500">Rent Status</p>
            <p className="mt-0.5 text-base text-emerald-800">Current · Paid Jul 2026</p>
          </div>
        </div>

        {/* Nav */}
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
                    "relative flex h-10 items-center gap-3 rounded-xl px-3 text-base transition-colors",
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
                  <span className="flex-1">{item.label}</span>
                  {item.badge && (
                    <span className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded-full text-sm",
                      isActive ? "bg-[#f3df27] text-[#151936]" : "bg-amber-100 text-amber-700",
                    )}>
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>

          {/* Divider */}
          <div className="my-4 h-px bg-slate-100" />

          {/* Account */}
          <p className="label-caps text-slate-300 px-3 mb-2">Account</p>
          <div className="space-y-0.5">
            {ACCOUNT_ITEMS.map((item) => {
              const ItemIcon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex h-9 items-center gap-3 rounded-xl px-3 text-base transition-colors",
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
        </nav>

        {/* Footer */}
        <div className="shrink-0 border-t border-slate-100 p-4">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 text-sm">
              TT
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-base text-slate-800">Tenant Account</p>
              <p className="truncate text-sm text-slate-400">tenant@example.com</p>
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
          <div className="flex size-8 items-center justify-center rounded-lg bg-slate-100">
            <IconHome size={18} stroke={1.75} className="text-[#151936]" />
          </div>
          <span className="text-base text-slate-900" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
            Tenant Portal
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Link href="/tenant/notifications" className="flex size-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100">
            <IconBell size={18} />
          </Link>
          <Link href="/tenant/profile" className="flex size-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100">
            <IconUserCircle size={20} />
          </Link>
        </div>
      </div>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-slate-200 bg-white px-2 pb-safe lg:hidden">
        {NAV_ITEMS.slice(0, 5).map((item) => {
          const ItemIcon = item.icon;
          const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 py-2 text-center transition-colors",
                isActive ? "text-[#151936]" : "text-slate-400 hover:text-slate-600",
              )}
            >
              <ItemIcon size={20} stroke={1.5} aria-hidden />
              <span className="text-xs">{item.label.split(" ")[0]}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
