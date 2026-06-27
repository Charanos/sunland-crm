"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  IconX,
  IconChevronDown,
  IconUser,
  IconShieldLock,
  IconSettings,
  IconLogout,
} from "@tabler/icons-react";
import { Avatar } from "@/components/ui/avatar";
import { IconButton } from "@/components/ui/icon-button";
import { cn } from "@/lib/utils/cn";
import { useUIStore } from "@/store/ui";
import {
  mobilePrimaryNav,
  navSections,
  getActiveNavItem,
  findSectionByPath,
} from "@/components/layout/nav-model";
import { TEAM_MEMBERS } from "./sunland-nav";
import { MOCK_DMS } from "@/data/messaging";

// ─── Mobile Bottom Pill Nav ──────────────────────────────────────────────────

export function MobileBottomNav() {
  const pathname = usePathname();
  const activeNavItem = getActiveNavItem(pathname);

  return (
    <nav
      aria-label="Mobile primary"
      className="fixed bottom-4 left-1/2 z-30 flex w-[min(25rem,calc(100vw-2rem))] -translate-x-1/2 items-center justify-between rounded-full border border-black/5 bg-white/90 p-2 shadow-[0_18px_52px_rgba(0,0,0,0.12)] backdrop-blur-2xl lg:hidden"
    >
      {mobilePrimaryNav.map((item) => {
        const IconComponent = item.icon;
        const isActive = activeNavItem?.href === item.href;

        return (
          <Link
            aria-label={item.label}
            className={cn(
              "focus-ring relative flex size-11 items-center justify-center rounded-full text-[var(--on-surface-dim)] transition",
              isActive && "text-white",
            )}
            href={item.href}
            key={item.href}
          >
            {isActive && (
              <motion.div
                layoutId="mobile-bottom-nav-active"
                className="absolute inset-0 rounded-full bg-[var(--sidebar)] shadow-md"
                initial={false}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
            <span className="relative z-10">
              <IconComponent aria-hidden size={20} stroke={1.8} />
            </span>
          </Link>
        );
      })}
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

  const isFinRoute = pathname.startsWith("/fin");
  const filteredSections = navSections
    .filter((section) => {
      const isFinSection = section.id.startsWith("finance");
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

  // Accordion: allow multiple open sections, auto-open active one
  const [openSections, setOpenSections] = useState<string[]>([activeSection.id]);

  // Re-sync open sections when drawer opens or pathname changes
  useEffect(() => {
    if (mobileNavOpen) {
      setOpenSections((prev) =>
        prev.includes(activeSection.id) ? prev : [...prev, activeSection.id],
      );
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
    setOpenSections((prev) =>
      prev.includes(sectionId)
        ? prev.filter((id) => id !== sectionId)
        : [...prev, sectionId],
    );
  };

  const totalUnread = MOCK_DMS.reduce((sum, dm) => sum + dm.unread, 0);
  const contextLabel = isFinRoute ? "Finance" : "Operations";
  const contextColor = isFinRoute
    ? "bg-emerald-400/20 text-emerald-300 border-emerald-400/30"
    : "bg-[var(--primary)]/20 text-[var(--primary)] border-[var(--primary)]/30";

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
            <img
              src="/logo.png"
              className="h-8 w-auto max-w-[160px] object-contain pl-1"
              alt="Sunland ERP Logo"
            />
          </Link>
          <div className="flex items-center gap-2">
            {/* Context pill */}
            <span className={cn("label-caps rounded-full border px-2.5 py-1", contextColor)}>
              {contextLabel}
            </span>
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
              const isOpen = openSections.includes(section.id);
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
                      <span className="text-caption">{item.label}</span>
                      {item.badge && (
                        <span className="ml-auto rounded-full bg-[var(--primary)]/20 px-2 py-0.5 text-tiny text-[var(--primary)]">
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
                                  <span className="text-caption">{item.label}</span>
                                  {item.badge && (
                                    <span className="ml-auto rounded-full bg-[var(--primary)]/20 px-2 py-0.5 text-tiny text-[var(--primary)]">
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
              {totalUnread > 0 && (
                <span className="rounded-full bg-[var(--primary)]/20 px-2 py-0.5 text-tiny text-[var(--primary)]">
                  {totalUnread} unread
                </span>
              )}
            </div>
            <div className="space-y-0.5">
              {TEAM_MEMBERS.map((member) => {
                const dmId = MOCK_DMS.find(
                  (dm) => dm.name === member.name,
                )?.id || "dm1";
                const dmContact = MOCK_DMS.find((dm) => dm.id === dmId);
                const unread = dmContact?.unread ?? 0;

                return (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => {
                      setSelectedChatDMId(dmId);
                      closeMobileNav();
                    }}
                    className="group flex w-full items-center gap-2.5 rounded-xl px-3 py-1.5 text-left transition-colors hover:bg-white/[0.04]"
                  >
                    <div className="relative shrink-0">
                      <Avatar
                        src={member.avatarUrl}
                        fallback={member.name.substring(0, 2)}
                        status={member.status}
                        className="size-8"
                      />
                      {unread > 0 && (
                        <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-[var(--primary)] text-[9px] text-[var(--on-primary)]">
                          {unread}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1 text-left">
                      <p className="truncate text-caption text-white/75 transition-colors group-hover:text-white/95">
                        {member.name}
                      </p>
                      <p className="truncate text-tiny text-white/40">{member.role}</p>
                    </div>
                  </button>
                );
              })}
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
              <div className="size-8 shrink-0 rounded-full bg-white/10 flex items-center justify-center">
                <IconUser size={15} className="text-white/60" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-caption text-white/75">My Profile</p>
                <p className="truncate text-tiny text-white/40">Account & preferences</p>
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
                  await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
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
