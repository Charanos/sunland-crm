"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  IconX,
  IconChevronDown,
  IconShieldLock,
  IconSettings,
  IconLogout,
} from "@tabler/icons-react";
import { Avatar } from "@/components/ui/avatar";
import { IconButton } from "@/components/ui/icon-button";
import { cn } from "@/lib/utils/cn";
import { useUIStore } from "@/store/ui";
import {
  getActiveNavItem,
  findSectionByPath,
  navSections,
} from "@/components/layout/nav-model";
import { useTeamMembers, getOrCreateDmConversationId } from "@/hooks/use-team-members";

import {
  IconHomeStats,
  IconChartBar,
  IconBuildingCommunity,
  IconUsersGroup,
  IconHomeDollar,
  IconWallet,
  IconReportAnalytics,
  IconMenu2,
} from "@tabler/icons-react";

// ─── Mobile Bottom Pill Nav ──────────────────────────────────────────────────

export function MobileBottomNav() {
  const pathname = usePathname();
  const { openMobileNav } = useUIStore();
  const isFinRoute = pathname.startsWith("/fin");

  const centerItem = { href: isFinRoute ? "/fin" : "/admin", label: "Overview", icon: IconHomeStats };
  const CenterIcon = centerItem.icon;

  const leftItems = isFinRoute
    ? [
      { href: "/fin/rentals/collections", label: "Rentals", icon: IconHomeDollar },
      { href: "/fin/ledger/journal-entries", label: "Ledger", icon: IconWallet },
    ]
    : [
      { href: "/admin/properties", label: "Properties", icon: IconBuildingCommunity },
      { href: "/admin/contacts", label: "Contacts", icon: IconUsersGroup },
    ];

  const rightItems = isFinRoute
    ? [
      { href: "/fin/reports/generate", label: "Reports", icon: IconReportAnalytics },
    ]
    : [
      { href: "/admin/pipeline", label: "Pipeline", icon: IconChartBar },
    ];

  return (
    <nav
      aria-label="Mobile primary"
      className="fixed inset-x-0 bottom-0 z-30 lg:hidden drop-shadow-[0_-12px_28px_rgba(0,0,0,0.12)]"
    >
      <div
        className="absolute inset-0 bg-white rounded-t-[32px] pb-safe"
        style={{
          maskImage: "radial-gradient(circle at 50% 8px, transparent 38px, black 39px)",
          WebkitMaskImage: "radial-gradient(circle at 50% 8px, transparent 38px, black 39px)",
        }}
      />
      <div className="relative flex h-[80px] items-center justify-between px-2 pb-safe">
        {/* Left items */}
        <div className="flex flex-1 justify-around pr-8">
          {leftItems.map((item) => {
            const isActive = pathname.startsWith(item.href) && item.href !== "/admin" && item.href !== "/fin";
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex w-16 flex-col items-center justify-center gap-1 transition-colors",
                  isActive ? "text-[#151936]" : "text-slate-400 hover:text-slate-600"
                )}
              >
                <Icon size={24} stroke={isActive ? 2 : 1.5} />
                <span className="text-xs font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>

        {/* Center elevated button */}
        <div className="absolute left-1/2 top-[-20px] flex flex-col items-center -translate-x-1/2">
          <Link
            href={centerItem.href}
            className="flex size-15 items-center justify-center rounded-full bg-tertiary-gradient text-white shadow-[0_8px_24px_rgba(18,42,32,0.3)] transition-transform hover:scale-105 active:scale-95"
          >
            <CenterIcon size={25} stroke={1.5} />
          </Link>
          <span className="absolute top-[72px] text-xs font-medium text-slate-400">
            {centerItem.label}
          </span>
        </div>

        {/* Right items + Menu */}
        <div className="flex flex-1 justify-around pl-8">
          {rightItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex w-16 flex-col items-center justify-center gap-1 transition-colors",
                  isActive ? "text-[#151936]" : "text-slate-400 hover:text-slate-600"
                )}
              >
                <Icon size={24} stroke={isActive ? 2 : 1.5} />
                <span className="text-xs font-medium">{item.label}</span>
              </Link>
            );
          })}
          <button
            onClick={openMobileNav}
            className="flex w-16 flex-col items-center justify-center gap-1 text-slate-400 transition-colors hover:text-slate-600"
          >
            <IconMenu2 size={24} stroke={1.5} />
            <span className="text-xs font-medium">Menu</span>
          </button>
        </div>
      </div>
    </nav>
  );
}

// ─── Mobile Navigation Drawer ────────────────────────────────────────────────

export function MobileNavigationDrawer() {
  const pathname = usePathname();
  const portalPrefix = pathname.startsWith("/fin") ? "/fin" : "/admin";
  const router = useRouter();
  const { closeMobileNav, mobileNavOpen, setSelectedChatDMId } = useUIStore();
  const activeNavItem = getActiveNavItem(pathname);
  const activeSection = findSectionByPath(pathname);
  const navRef = useRef<HTMLDivElement>(null);

  const [currentUser, setCurrentUser] = useState({
    name: "Paul Amos",
    email: "ceo@sunlandre.co.ke",
    role: "ceo",
    avatarUrl: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=80&h=80&fit=crop&crop=face",
  });

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data?.user) {
          setCurrentUser({
            name: data.user.name,
            email: data.user.email,
            role: data.user.role,
            avatarUrl: data.user.avatarUrl || "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=80&h=80&fit=crop&crop=face",
          });
        }
      })
      .catch(() => { });
  }, []);

  const isFinRoute = pathname.startsWith("/fin");
  const filteredSections = navSections
    .filter((section) => {
      const isFinSection = section.id.startsWith("fin-");
      return isFinRoute ? isFinSection : !isFinSection;
    })
    .map((section) => {
      const items = section.items.map((item) => {
        if (portalPrefix === "/fin" && item.href.startsWith("/admin/")) {
          const keys = ["settings", "profile", "notifications", "security", "messages"];
          const segment = item.href.split("/")[2];
          if (keys.includes(segment)) {
            return { ...item, href: item.href.replace("/admin/", "/fin/") };
          }
        }
        return item;
      });
      return { ...section, items };
    });

  // Accordion: only one open at a time, auto-open active one
  const [openSection, setOpenSection] = useState<string>(activeSection.id);

  // Re-sync open sections when drawer opens or pathname changes
  useEffect(() => {
    if (mobileNavOpen) {
      Promise.resolve().then(() => setOpenSection(activeSection.id));
    }
  }, [mobileNavOpen, activeSection.id]);

  // Scroll active item into view on drawer open
  useEffect(() => {
    if (mobileNavOpen && navRef.current) {
      const activeEl = navRef.current.querySelector<HTMLElement>("[data-active='true']");
      if (activeEl) {
        setTimeout(() => activeEl.scrollIntoView({ behavior: "smooth", block: "center" }), 200);
      }
    }
  }, [mobileNavOpen]);

  const toggleSection = (sectionId: string) => {
    setOpenSection((prev) => (prev === sectionId ? "" : sectionId));
  };

  const { members: teamMembers } = useTeamMembers();

  if (!mobileNavOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm lg:hidden">
      {/* Backdrop tap to close */}
      <button
        aria-label="Close navigation backdrop"
        className="absolute inset-0 size-full cursor-default"
        onClick={closeMobileNav}
        type="button"
      />

      {/* Drawer panel */}
      <motion.aside
        initial={{ x: "-100%" }}
        animate={{ x: 0 }}
        exit={{ x: "-100%" }}
        transition={{ type: "spring", stiffness: 380, damping: 35 }}
        className="absolute inset-y-0 left-0 flex w-[min(22rem,92vw)] flex-col border-r border-white/5 bg-[var(--sidebar)] text-white shadow-2xl"
      >
        {/* ── Header ─────────────────────────────────────── */}
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-white/[0.08] px-4">
          <Link href={isFinRoute ? "/fin" : "/admin"} onClick={closeMobileNav}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.png"
              className="h-10 w-auto max-w-[160px] object-contain pl-1"
              alt="Sunland ERP Logo"
            />
          </Link>
          <div className="flex items-center gap-2">
            <IconButton
              aria-label="Close navigation"
              className="size-9 border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
              onClick={closeMobileNav}
            >
              <IconX aria-hidden size={16} />
            </IconButton>
          </div>
        </div>

        {/* ── Scrollable nav body ─────────────────────────── */}
        <nav ref={navRef} className="flex-1 overflow-y-auto p-3 [scrollbar-width:thin]">
          <div className="space-y-1">
            {filteredSections.map((section) => {
              const SectionIcon = section.icon;
              const isOpen = openSection === section.id;
              const isSingleItem = section.items.length === 1;

              // Single-item sections render as a direct link (no accordion wrapper)
              if (isSingleItem) {
                const item = section.items[0];
                const IconComponent = item.icon;
                const isActive = activeNavItem?.href === item.href;

                return (
                  <Link
                    key={section.id}
                    href={item.href}
                    onClick={closeMobileNav}
                    data-active={isActive}
                    className={cn(
                      "focus-ring relative flex h-10 items-center gap-3 rounded-xl px-3 text-white/80 transition",
                      "hover:bg-white/[0.06] hover:text-white",
                      isActive && "bg-white/[0.1] text-white",
                    )}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="mobile-drawer-active"
                        className="absolute inset-0 rounded-xl bg-white/[0.08] border border-white/[0.06]"
                        initial={false}
                        transition={{ type: "spring", stiffness: 380, damping: 30 }}
                      />
                    )}
                    <span className="relative z-10 flex w-full items-center gap-3">
                      <IconComponent aria-hidden size={17} stroke={1.8} />
                      <span className="text-sm font-medium">{item.label}</span>
                      {item.badge && (
                        <span className="ml-auto rounded-md bg-[#f3df27]/10 px-1.5 py-0.5 text-xxs font-medium tracking-widest uppercase text-[#f3df27]/90 ring-1 ring-[#f3df27]/20 shrink-0">
                          {item.badge}
                        </span>
                      )}
                    </span>
                  </Link>
                );
              }

              // Multi-item sections: accordion
              return (
                <div key={section.id}>
                  <button
                    type="button"
                    onClick={() => toggleSection(section.id)}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-white/[0.04]"
                  >
                    <SectionIcon aria-hidden size={16} stroke={1.8} className="shrink-0 text-white/50" />
                    <span className="label-caps flex-1 text-white/50">{section.label}</span>
                    <motion.div
                      animate={{ rotate: isOpen ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <IconChevronDown size={14} className="text-white/30" aria-hidden />
                    </motion.div>
                  </button>

                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        key="content"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] }}
                        className="overflow-hidden"
                      >
                        <div className="ml-2 space-y-0.5 border-l border-white/[0.07] pl-3 pb-2">
                          {section.items.map((item) => {
                            const IconComponent = item.icon;
                            const isActive = activeNavItem?.href === item.href;

                            return (
                              <Link
                                key={item.href}
                                href={item.href}
                                onClick={closeMobileNav}
                                data-active={isActive}
                                className={cn(
                                  "focus-ring relative flex h-9 items-center gap-3 rounded-xl px-3 text-white/70 transition",
                                  "hover:bg-white/[0.06] hover:text-white",
                                  isActive && "bg-white/[0.1] text-white",
                                )}
                              >
                                {isActive && (
                                  <motion.div
                                    layoutId="mobile-drawer-active"
                                    className="absolute inset-0 rounded-xl bg-white/[0.08] border border-white/[0.06]"
                                    initial={false}
                                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                                  />
                                )}
                                <span className="relative z-10 flex w-full items-center gap-3">
                                  <IconComponent aria-hidden size={16} stroke={1.8} />
                                  <span className="text-sm font-medium">{item.label}</span>
                                  {item.badge && (
                                    <span className="ml-auto rounded-md bg-[#f3df27]/10 px-1.5 py-0.5 text-xxs font-medium tracking-widest uppercase text-[#f3df27]/90 ring-1 ring-[#f3df27]/20 shrink-0">
                                      {item.badge}
                                    </span>
                                  )}
                                </span>
                              </Link>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>

          {/* ── Team Section ──────────────────────────────── */}
          <div className="mt-4 border-t border-white/[0.08] pt-4">
            <div className="mb-2 flex items-center justify-between px-3">
              <p className="label-caps text-white/50">Team</p>
            </div>
            <div className="space-y-0.5">
              {teamMembers.map((member) => (
                <button
                  key={member.id}
                  type="button"
                  onClick={async () => {
                    const isMessagesPage = pathname?.endsWith("/messages");
                    const conversationId = await getOrCreateDmConversationId("group", member.id);
                    if (conversationId) setSelectedChatDMId(conversationId, !isMessagesPage);
                    closeMobileNav();
                  }}
                  className="group flex w-full items-center gap-2.5 rounded-xl px-3 py-1.5 text-left transition-colors hover:bg-white/[0.04]"
                >
                  <Avatar
                    src={member.avatarUrl ?? undefined}
                    fallback={member.name.substring(0, 2)}
                    status="online"
                    className="size-9 shrink-0 border border-white/10 shadow-sm"
                  />
                  <div className="min-w-0 flex-1 text-left">
                    <p className="truncate text-sm font-medium text-white/80 transition-colors group-hover:text-white/95">
                      {member.name}
                    </p>
                    <p className="truncate text-xxs font-medium uppercase tracking-wider text-white/40 mt-0.5">
                      {member.role.replace(/_/g, " ")}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </nav>

        {/* ── Footer: Profile shortcut ────────────────────── */}
        <div className="shrink-0 border-t border-white/[0.08] p-3">
          <div className="flex items-center gap-2">
            <Link
              href={`${portalPrefix}/profile`}
              onClick={closeMobileNav}
              className="flex flex-1 items-center gap-2.5 rounded-xl px-2.5 py-2 transition-colors hover:bg-white/[0.06]"
            >
              <Avatar
                src={currentUser.avatarUrl}
                fallback={currentUser.name.substring(0, 2).toUpperCase()}
                status="online"
                className="size-10 shrink-0 border border-white/10 shadow-sm"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white/95">{currentUser.name}</p>
                <p className="truncate text-xxs font-medium uppercase tracking-widest text-white/40 mt-0.5">{currentUser.role.replace(/_/g, " ")}</p>
              </div>
            </Link>
            <div className="flex items-center gap-1">
              <Link
                href={`${portalPrefix}/settings`}
                onClick={closeMobileNav}
                aria-label="Settings"
                className="flex size-8 items-center justify-center rounded-lg text-white/40 transition hover:bg-white/[0.08] hover:text-white/70"
              >
                <IconSettings size={15} aria-hidden />
              </Link>
              <Link
                href={`${portalPrefix}/security`}
                onClick={closeMobileNav}
                aria-label="Security"
                className="flex size-8 items-center justify-center rounded-lg text-white/40 transition hover:bg-white/[0.08] hover:text-white/70"
              >
                <IconShieldLock size={15} aria-hidden />
              </Link>
              <button
                type="button"
                aria-label="Logout"
                onClick={async () => {
                  closeMobileNav();
                  await fetch("/api/auth/logout", { method: "POST" }).catch(() => { });
                  router.push("/login");
                }}
                className="flex size-8 items-center justify-center rounded-lg text-white/40 transition hover:bg-rose-500/10 hover:text-rose-400"
              >
                <IconLogout size={15} aria-hidden />
              </button>
            </div>
          </div>
        </div>
      </motion.aside>
    </div>
  );
}
