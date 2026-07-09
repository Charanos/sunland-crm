"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  IconBuildingCommunity,
  IconCheck,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconExternalLink,
  IconHelp,
  IconLogout,
  IconPlus,
  IconSettings,
  IconShield,
  IconUserCircle,
  IconUsersGroup,
  type Icon,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils/cn";
import { useUIStore } from "@/store/ui";
import {
  findSectionByPath,
  getActiveNavItem,
  navSections,
} from "@/components/layout/nav-model";
import { canAccess } from "@/lib/auth/roles";
import type { UserRole } from "@/types";
import { Avatar } from "@/components/ui/avatar";
import { ENTITIES, getEntityById } from "@/data/entities";
import Image from "next/image";
import { useTeamMembers, getOrCreateDmConversationId } from "@/hooks/use-team-members";

// ─── Hook: click-outside + escape ────────────────────────────────────────────

function useClickOutside(ref: React.RefObject<HTMLElement | null>, onClose: () => void) {
  useEffect(() => {
    function handler(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function escape(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("pointerdown", handler);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", handler);
      document.removeEventListener("keydown", escape);
    };
  }, [ref, onClose]);
}

// ─── Sub-components ──────────────────────────────────────────────────────────

/** Tooltip wrapper shown when sidebar is collapsed */
function NavTooltip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="group/tip relative flex justify-center">
      {children}
      <div
        role="tooltip"
        className={cn(
          "pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 z-[60]",
          "whitespace-nowrap rounded-lg border border-white/[0.06] bg-[var(--surface-highest)]",
          "px-2.5 py-1.5 text-base font-medium text-white/90 shadow-xl backdrop-blur-2xl",
          "opacity-0 translate-x-[-4px] group-hover/tip:opacity-100 group-hover/tip:translate-x-0",
          "transition-all duration-150",
        )}
      >
        {label}
        {/* Arrow */}
        <span className="absolute right-full top-1/2 -translate-y-1/2 border-[5px] border-transparent border-r-white/[0.06]" />
      </div>
    </div>
  );
}

/** A flyout panel for collapsed nav groups */
function CollapsedFlyout({
  section,
  activeHref,
}: {
  section: (typeof navSections)[number];
  activeHref: string | undefined;
}) {
  return (
    <div
      className={cn(
        "absolute left-full top-0 ml-3 z-[60] w-52",
        "rounded-xl border border-white/[0.06] bg-[var(--surface-highest)] p-1.5",
        "shadow-2xl backdrop-blur-2xl",
        "opacity-0 pointer-events-none scale-95 origin-top-left",
        "group-hover/collapsed:opacity-100 group-hover/collapsed:pointer-events-auto group-hover/collapsed:scale-100",
        "transition-all duration-150",
      )}
      role="menu"
      aria-label={section.label}
    >
      <p className="px-2 pb-1.5 pt-1 text-white/30 label-caps">
        {section.label}
      </p>
      {section.items.map((item, index) => {
        const isActive = activeHref === item.href;
        const ItemIcon = item.icon;
        const showGroup = item.group && item.group !== section.items[index - 1]?.group;
        return (
          <div key={item.href}>
            {showGroup && (
              <p className="px-2 pb-1 pt-2 text-white/25 label-caps">
                {item.group}
              </p>
            )}
            <Link
              href={item.href}
              role="menuitem"
              className={cn(
                "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-base transition-colors",
                isActive
                  ? "bg-white/[0.08] text-white"
                  : "text-white/65 hover:bg-white/[0.05] hover:text-white/90",
              )}
            >
              <ItemIcon size={14} stroke={1.5} className="shrink-0 opacity-65" aria-hidden />
              {item.label}
              {isActive && <IconCheck size={12} className="ml-auto text-white/50" aria-hidden />}
            </Link>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function SunlandNav() {
  const pathname = usePathname();
  const portalPrefix = pathname.startsWith("/fin") ? "/fin" : "/admin";
  const {
    activeSidebarSection,
    sidebarCollapsed,
    setActiveSidebarSection,
    toggleSidebar,
    activeEntityId,
    setSwitchingToEntityId,
    setSelectedChatDMId,
  } = useUIStore();

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

  const isSwitcherEnabled = currentUser.role === "ceo" || currentUser.role === "general_manager";

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch { }
    window.location.href = "/login";
  };

  const { members: teamMembers } = useTeamMembers();

  const handleOpenTeamChat = async (userId: string) => {
    const isMessagesPage = pathname?.endsWith("/messages");
    const conversationId = await getOrCreateDmConversationId("group", userId);
    if (conversationId) setSelectedChatDMId(conversationId, !isMessagesPage);
  };

  const [isSwitcherOpen, setIsSwitcherOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const activeEntity = getEntityById(activeEntityId);

  const switcherRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  const closeSwitcher = useCallback(() => setIsSwitcherOpen(false), []);
  const closeProfile = useCallback(() => setIsProfileOpen(false), []);

  useClickOutside(switcherRef, closeSwitcher);
  useClickOutside(profileRef, closeProfile);

  useEffect(() => {
    setActiveSidebarSection(findSectionByPath(pathname).id);
  }, [pathname, setActiveSidebarSection]);

  // Close dropdowns on route change
  useEffect(() => {
    const t = setTimeout(() => {
      setIsSwitcherOpen(false);
      setIsProfileOpen(false);
    }, 0);
    return () => clearTimeout(t);
  }, [pathname]);

  const activeNavItem = getActiveNavItem(pathname);

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-30 hidden flex-col",
        "border-r border-white/[0.04] bg-[var(--sidebar)] text-white",
        "transition-[width] duration-300 ease-out lg:flex",
        sidebarCollapsed ? "w-[72px]" : "w-[272px]",
      )}
    >
      {/* ── Floating Collapse Toggle ─────────────────────────── */}
      <button
        aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        type="button"
        onClick={toggleSidebar}
        className={cn(
          "focus-ring absolute -right-3 top-[54px] z-40",
          "flex size-[22px] items-center justify-center rounded-full",
          "border border-[var(--primary)] bg-[var(--primary)] text-[var(--on-primary)] shadow-[0_4px_12px_rgba(0,0,0,0.4)]",
          "transition hover:scale-110 hover:bg-[var(--primary-container)] hover:border-[var(--primary-container)]",
        )}
      >
        {sidebarCollapsed
          ? <IconChevronRight aria-hidden size={12} stroke={2.5} />
          : <IconChevronLeft aria-hidden size={12} stroke={2.5} />}
      </button>

      {/* ── Brand + Entity Switcher ──────────────────────────── */}
      <div className="shrink-0 border-b border-white/[0.04] px-4 pb-3 pt-6">
        {/* Brand row */}
        <Link
          href="/admin"
          aria-label="Sunland ERP dashboard"
          className={cn(
            "focus-ring flex items-center transition hover:bg-white/[0.03] rounded-xl",
            sidebarCollapsed ? "justify-center p-2" : "p-1.5"
          )}
        >
          {sidebarCollapsed ? (
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#f3df27]/10 text-[#f3df27] border border-[#f3df27]/25 shadow-sm transition">
              <IconBuildingCommunity aria-hidden size={20} stroke={1.75} />
            </span>
          ) : (
            <Image
              src="/logo.png"
              width={250}
              height={155}
              alt="Sunland ERP Logo"
              className="w-auto h-14"
            />
          )}
        </Link>

        {/* Line separator above entity switcher */}
        <div className="hidden my-3 h-px bg-white/[0.05]" />

        {/* Entity Switcher */}
        <div className="hidden relative mt-2" ref={switcherRef}>
          {sidebarCollapsed ? (
            <NavTooltip label={isSwitcherEnabled ? `Switch Workspace (${activeEntity.name})` : `Active Workspace (${activeEntity.name})`}>
              <button
                type="button"
                aria-haspopup={isSwitcherEnabled ? "listbox" : undefined}
                aria-expanded={isSwitcherEnabled ? isSwitcherOpen : undefined}
                aria-label={isSwitcherEnabled ? "Switch entity" : "Active entity"}
                onClick={isSwitcherEnabled ? () => { setIsSwitcherOpen((v) => !v); setIsProfileOpen(false); } : undefined}
                className={cn(
                  "focus-ring flex w-full items-center gap-2.5 rounded-xl px-2 py-2 transition-colors",
                  isSwitcherOpen ? "bg-white/[0.06]" : isSwitcherEnabled ? "hover:bg-white/[0.03] justify-center" : "justify-center",
                )}
              >
                <Avatar
                  src={activeEntity.avatarUrl}
                  fallback={activeEntity.name.substring(0, 2)}
                  shape="rounded-lg"
                  className="size-7 shrink-0"
                />
              </button>
            </NavTooltip>
          ) : (
            <button
              type="button"
              aria-haspopup={isSwitcherEnabled ? "listbox" : undefined}
              aria-expanded={isSwitcherEnabled ? isSwitcherOpen : undefined}
              aria-label={isSwitcherEnabled ? "Switch entity" : "Active entity"}
              onClick={isSwitcherEnabled ? () => { setIsSwitcherOpen((v) => !v); setIsProfileOpen(false); } : undefined}
              className={cn(
                "focus-ring flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left transition-colors",
                isSwitcherOpen ? "bg-white/[0.06]" : isSwitcherEnabled ? "hover:bg-white/[0.03]" : "",
              )}
            >
              <Avatar
                src={activeEntity.avatarUrl}
                fallback={activeEntity.name.substring(0, 2)}
                shape="rounded-lg"
                className="size-7 shrink-0"
              />
              <AnimatePresence>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="flex flex-1 items-center justify-between min-w-0"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-white/85 text-base">{activeEntity.name}</p>
                    <p className="truncate text-sm text-white/35">{activeEntity.subtitle}</p>
                  </div>
                  {isSwitcherEnabled && (
                    <IconChevronDown
                      size={13}
                      className={cn("shrink-0 text-white/25 transition-transform duration-200", isSwitcherOpen && "rotate-180")}
                      aria-hidden
                    />
                  )}
                </motion.div>
              </AnimatePresence>
            </button>
          )}

          {/* Entity Switcher Dropdown */}
          <AnimatePresence>
            {isSwitcherOpen && !sidebarCollapsed && (
              <motion.div
                role="listbox"
                aria-label="Select entity"
                initial={{ opacity: 0, y: -6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.97 }}
                transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] as const }}
                className={cn(
                  "absolute left-0 top-full z-[60] mt-2 w-full overflow-hidden",
                  "rounded-xl border border-white/[0.07] bg-[var(--surface-highest)]",
                  "shadow-[0_24px_48px_rgba(0,0,0,0.5)] backdrop-blur-2xl",
                )}
              >
                <div className="p-1.5">
                  <p className="px-2 pb-1 pt-1 text-white/30 label-caps">
                    Entities
                  </p>
                  {ENTITIES.map((entity) => {
                    const isActive = entity.id === activeEntity.id;
                    return (
                      <button
                        key={entity.id}
                        role="option"
                        aria-selected={isActive}
                        type="button"
                        onClick={() => { setSwitchingToEntityId(entity.id); setIsSwitcherOpen(false); }}
                        className={cn(
                          "flex w-full items-center gap-2.5 rounded-lg p-2 text-left transition-colors",
                          isActive ? "bg-white/[0.07]" : "hover:bg-white/[0.04]",
                        )}
                      >
                        <Avatar
                          src={entity.avatarUrl}
                          fallback={entity.name.substring(0, 2)}
                          shape="rounded-lg"
                          className="size-7 shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <p className={cn("truncate text-[12.5px]", isActive ? "font-medium text-white" : "text-white/75")}>
                            {entity.name}
                          </p>
                          <p className="truncate text-sm text-white/35">{entity.subtitle}</p>
                        </div>
                        {isActive && <IconCheck size={13} className="shrink-0 text-white/40" aria-hidden />}
                      </button>
                    );
                  })}
                </div>
                <div className="border-t border-white/[0.04] p-1">
                  <button
                    type="button"
                    className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-white/35 transition-colors hover:bg-white/[0.04] hover:text-white/60"
                  >
                    <IconExternalLink size={11} aria-hidden />
                    Manage entities
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>


      {/* ── Main Navigation ──────────────────────────────────── */}
      <nav
        aria-label="Primary navigation"
        className={cn(
          "flex-1 overflow-y-auto py-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden",
          sidebarCollapsed ? "px-2.5" : "px-4",
        )}
      >
        <div className="space-y-0.5 pt-6">
          {navSections
            .filter((section) => {
              // Section IDs: fin-* = Finance portal only; exec-* = CEO/admin portal only.
              // ADR 010: each portal shows only its own sections.
              const isFinRoute = pathname.startsWith("/fin");
              const isFinSection = section.id.startsWith("fin-");
              return isFinRoute ? isFinSection : !isFinSection;
            })
            .map((section) => {
              // Filter items the current user can actually access (action-level gating
              // is in the service layer; this is coarse portal-nav visibility only).
              const items = section.items
                .filter((item) => canAccess(currentUser.role as UserRole, item.href));
              return { ...section, items };
            })
            .filter((section) => section.items.length > 0)
            .map((section) => {
              const isSingleItem = section.items.length === 1;
              const open = activeSidebarSection === section.id;
              const SectionIcon = section.icon;

              /* ── Collapsed state ── */
              if (sidebarCollapsed) {
                return isSingleItem ? (
                  <NavTooltip key={section.id} label={section.label}>
                    <Link
                      href={section.items[0].href}
                      aria-label={section.label}
                      title={section.label}
                      className={cn(
                        "focus-ring flex size-10 items-center justify-center rounded-xl transition-colors",
                        activeNavItem?.href === section.items[0].href
                          ? "bg-white/[0.08] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
                          : "text-white/40 hover:bg-white/[0.04] hover:text-white/80",
                      )}
                    >
                      <SectionIcon size={19} stroke={1.5} aria-hidden />
                    </Link>
                  </NavTooltip>
                ) : (
                  <div key={section.id} className="group/collapsed relative">
                    <NavTooltip label={section.label}>
                      <button
                        type="button"
                        aria-label={section.label}
                        title={section.label}
                        className={cn(
                          "focus-ring flex size-10 items-center justify-center rounded-xl transition-colors",
                          section.items.some((i) => i.href === activeNavItem?.href)
                            ? "bg-white/[0.08] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
                            : "text-white/40 hover:bg-white/[0.04] hover:text-white/80",
                        )}
                      >
                        <SectionIcon size={19} stroke={1.5} aria-hidden />
                      </button>
                    </NavTooltip>
                    <CollapsedFlyout section={section} activeHref={activeNavItem?.href} />
                  </div>
                );
              }

              /* ── Expanded: single item (flat link) ── */
              if (isSingleItem) {
                const item = section.items[0];
                const isActive = activeNavItem?.href === item.href;
                return (
                  <Link
                    key={section.id}
                    href={item.href}
                    className={cn(
                      "focus-ring group relative flex h-9 w-full items-center gap-3 rounded-xl px-3 transition-colors",
                      isActive
                        ? "text-white"
                        : "text-white/55 hover:text-white/90 hover:bg-white/[0.02]",
                    )}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="sidebar-nav-pill"
                        className="absolute inset-0 rounded-xl bg-white/[0.05] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
                        initial={false}
                        transition={{ type: "spring", stiffness: 380, damping: 30 }}
                      />
                    )}
                    <SectionIcon
                      size={18}
                      stroke={1.5}
                      aria-hidden
                      className={cn("relative z-10 transition-colors", isActive ? "text-white" : "group-hover:text-white/75")}
                    />
                    <span className="relative z-10 body-md">{section.label}</span>
                  </Link>
                );
              }

              /* ── Expanded: group ── */
              return (
                <section key={section.id} className="relative">
                  <button
                    type="button"
                    aria-controls={`nav-section-${section.id}`}
                    aria-expanded={open}
                    onClick={() => setActiveSidebarSection(open ? "" : section.id)}
                    className={cn(
                      "focus-ring group relative flex h-9 w-full items-center gap-3 rounded-xl px-3 text-left transition-colors",
                      open ? "text-white/90" : "text-white/55 hover:text-white/90 hover:bg-white/[0.02]",
                    )}
                  >
                    <SectionIcon
                      size={18}
                      stroke={1.5}
                      aria-hidden
                      className={cn("transition-colors", open ? "text-white/80" : "group-hover:text-white/75")}
                    />
                    <span className="flex-1 body-md">{section.label}</span>
                    <IconChevronDown
                      size={13}
                      aria-hidden
                      className={cn("transition-transform text-white/25 group-hover:text-white/45", open && "rotate-180")}
                    />
                  </button>

                  <AnimatePresence initial={false}>
                    {open && (
                      <motion.div
                        id={`nav-section-${section.id}`}
                        key="content"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.18, ease: "easeInOut" }}
                        className="overflow-hidden"
                      >
                        <div className="relative mt-0.5 ml-5 space-y-0.5 pb-1.5">
                          {/* Vertical rail */}
                          <div className="absolute left-0 top-1 bottom-3 w-px bg-[#f3df27]/30" />

                          {section.items.map((item, index) => {
                            const isActive = activeNavItem?.href === item.href;
                            const showGroup = item.group && item.group !== section.items[index - 1]?.group;
                            return (
                              <div key={item.href}>
                                {showGroup && (
                                  <p className="pb-1 pl-5 pt-2 text-white/25 label-caps">
                                    {item.group}
                                  </p>
                                )}
                                <Link
                                  href={item.href}
                                  className={cn(
                                    "focus-ring relative flex h-8 items-center rounded-lg pl-5 pr-3 text-base transition-colors",
                                    isActive
                                      ? "text-white"
                                      : "text-white/52 hover:text-white/80",
                                  )}
                                >
                                  {/* Horizontal connector */}
                                  <span className={cn(
                                    "absolute left-0 top-1/2 -translate-y-1/2 h-px w-3",
                                    isActive ? "bg-[#f3df27]" : "bg-[#f3df27]/35"
                                  )} />

                                  {isActive && (
                                    <motion.div
                                      layoutId="sidebar-child-pill"
                                      className="absolute inset-0 rounded-lg bg-white/[0.04] shadow-[inset_0_1px_0_rgba(255,255,255,0.025)]"
                                      initial={false}
                                      transition={{ type: "spring", stiffness: 400, damping: 32 }}
                                    />
                                  )}

                                  <span className="relative z-10 truncate">{item.label}</span>

                                  {item.badge && (
                                    <span className="relative z-10 ml-auto rounded-full bg-white/[0.07] px-2 py-0.5 text-sm  text-white/50 font-medium">
                                      {item.badge}
                                    </span>
                                  )}
                                </Link>
                              </div>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </section>
              );
            })}
        </div>

        {/* ── Divider ─────────────────────────────────────────── */}
        <div className="my-5 px-2">
          <div className="h-px bg-white/[0.04]" />
        </div>

        {/* ── Team / Messages ─────────────────────────────────── */}
        <div>
          <div className={cn("flex items-center mb-2", sidebarCollapsed ? "justify-center" : "justify-between pl-2 pr-1")}>
            {!sidebarCollapsed && (
              <p className="label-caps text-white/25 tracking-widest">Team</p>
            )}
            <button
              type="button"
              aria-label="Start new conversation"
              className={cn(
                "flex items-center justify-center rounded-lg text-white/30 transition-colors hover:bg-white/[0.05] hover:text-white/70",
                sidebarCollapsed ? "size-10" : "size-6",
              )}
            >
              <IconPlus size={14} stroke={2} aria-hidden />
            </button>
          </div>

          <div className={cn("space-y-0.5", sidebarCollapsed && "flex flex-col items-center gap-0.5")}>
            {teamMembers.map((member) =>
              sidebarCollapsed ? (
                <NavTooltip key={member.id} label={`${member.name} · ${member.role.replace("_", " ")}`}>
                  <button
                    type="button"
                    aria-label={member.name}
                    onClick={() => handleOpenTeamChat(member.id)}
                    className="flex size-10 items-center justify-center rounded-xl transition-colors hover:bg-white/[0.04]"
                  >
                    <Avatar
                      src={member.avatarUrl ?? undefined}
                      fallback={member.name.substring(0, 2)}
                      className="size-8"
                    />
                  </button>
                </NavTooltip>
              ) : (
                <button
                  key={member.id}
                  type="button"
                  aria-label={`Message ${member.name}`}
                  onClick={() => handleOpenTeamChat(member.id)}
                  className="group flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 transition-colors hover:bg-white/[0.04]"
                >
                  <Avatar
                    src={member.avatarUrl ?? undefined}
                    fallback={member.name.substring(0, 2)}
                    className="size-8 shrink-0"
                  />
                  <div className="min-w-0 text-left">
                    <p className="truncate text-base text-white/75 group-hover:text-white/95 transition-colors">
                      {member.name}
                    </p>
                    <p className="truncate text-sm text-white/40">{member.role.replace("_", " ")}</p>
                  </div>
                </button>
              )
            )}
          </div>
        </div>
      </nav>

      {/* ── Profile Footer ───────────────────────────────────── */}
      <div
        ref={profileRef}
        className={cn(
          "relative shrink-0 border-t border-white/[0.04]",
          sidebarCollapsed ? "p-2.5" : "p-3",
        )}
      >
        {/* Profile popup */}
        <AnimatePresence>
          {isProfileOpen && !sidebarCollapsed && (
            <motion.div
              role="dialog"
              aria-label="Account menu"
              initial={{ opacity: 0, y: 8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
              className={cn(
                "absolute bottom-full left-3 right-3 mb-2 z-[60] overflow-hidden",
                "rounded-xl border border-white/[0.07] bg-[var(--surface-highest)]",
                "shadow-[0_24px_48px_rgba(0,0,0,0.55)] backdrop-blur-2xl",
              )}
            >
              {/* Profile header */}
              <div className="flex items-start gap-2.5 border-b border-white/[0.05] px-3 py-2.5">
                <Avatar
                  src={currentUser.avatarUrl}
                  fallback={currentUser.name.substring(0, 2).toUpperCase()}
                  status="online"
                  className="size-8 shrink-0 mt-0.5"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base text-white/92">{currentUser.name}</p>
                  <p className="truncate text-sm  text-white/50">{currentUser.email}</p>
                </div>
                <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-white/45 mt-0.5 shrink-0 label-caps">
                  {currentUser.role}
                </span>
              </div>

              {/* Actions */}
              <div className="p-1">
                <Link
                  href={`${portalPrefix}/profile`}
                  onClick={() => setIsProfileOpen(false)}
                  className="text-label flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-white/68 transition-colors hover:bg-white/[0.05] hover:text-white/92"
                >
                  <IconUserCircle size={14} aria-hidden className="shrink-0 opacity-65" />
                  My Profile
                </Link>
                <Link
                  href={`${portalPrefix}/settings`}
                  onClick={() => setIsProfileOpen(false)}
                  className="text-label flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-white/68 transition-colors hover:bg-white/[0.05] hover:text-white/92"
                >
                  <IconSettings size={14} aria-hidden className="shrink-0 opacity-65" />
                  Settings & Preferences
                </Link>
                <Link
                  href={`${portalPrefix}/messages`}
                  onClick={() => setIsProfileOpen(false)}
                  className="text-label flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-white/68 transition-colors hover:bg-white/[0.05] hover:text-white/92"
                >
                  <IconUsersGroup size={14} aria-hidden className="shrink-0 opacity-65" />
                  Team Messages
                </Link>
                <Link
                  href={`${portalPrefix}/security`}
                  onClick={() => setIsProfileOpen(false)}
                  className="text-label flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-white/68 transition-colors hover:bg-white/[0.05] hover:text-white/92"
                >
                  <IconShield size={14} aria-hidden className="shrink-0 opacity-65" />
                  Security & Access
                </Link>
                <a
                  href="mailto:support@sunland.co.ke"
                  className="text-label flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-white/68 transition-colors hover:bg-white/[0.05] hover:text-white/92"
                >
                  <IconHelp size={14} aria-hidden className="shrink-0 opacity-65" />
                  Help & Support
                </a>
              </div>

              {/* Log out */}
              <div className="border-t border-white/[0.05] p-1">
                <button
                  type="button"
                  onClick={handleLogout}
                  className={cn(
                    "text-label flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 transition-colors",
                    "text-[var(--error)] hover:bg-[var(--error)]/10 hover:text-red-300",
                  )}
                >
                  <IconLogout size={14} aria-hidden />
                  Log out of Sunland ERP
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Profile trigger button */}
        {sidebarCollapsed ? (
          <NavTooltip label="Account Menu">
            <button
              type="button"
              aria-haspopup="dialog"
              aria-expanded={isProfileOpen}
              aria-label="Open account menu"
              onClick={() => { setIsProfileOpen((v) => !v); setIsSwitcherOpen(false); }}
              className={cn(
                "focus-ring flex w-full items-center justify-center rounded-xl p-1.5 transition-colors hover:bg-white/[0.04]",
                isProfileOpen && "bg-white/[0.05]"
              )}
            >
              <Avatar
                src={currentUser.avatarUrl}
                fallback={currentUser.name.substring(0, 2).toUpperCase()}
                status="online"
                className="size-9 shrink-0"
              />
            </button>
          </NavTooltip>
        ) : (
          <button
            type="button"
            aria-haspopup="dialog"
            aria-expanded={isProfileOpen}
            aria-label="Open account menu"
            onClick={() => { setIsProfileOpen((v) => !v); setIsSwitcherOpen(false); }}
            className={cn(
              "focus-ring flex w-full items-center gap-3 rounded-xl p-2 transition-colors hover:bg-white/[0.04]",
              isProfileOpen && "bg-white/[0.05]"
            )}
          >
            <Avatar
              src={currentUser.avatarUrl}
              fallback={currentUser.name.substring(0, 2).toUpperCase()}
              status="online"
              className="size-9 shrink-0"
            />
            <AnimatePresence>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="flex flex-1 items-start justify-between min-w-0"
              >
                <div className="min-w-0 text-left">
                  <p className="truncate text-base text-white/92">{currentUser.name}</p>
                  <p className="truncate text-sm text-white/40 lowercase leading-none mt-1">{currentUser.email}</p>
                </div>
                <IconChevronDown
                  size={13}
                  aria-hidden
                  className={cn("shrink-0 text-white/25 transition-transform duration-200 mt-0.5", isProfileOpen && "rotate-180")}
                />
              </motion.div>
            </AnimatePresence>
          </button>
        )}
      </div>
    </aside>
  );
}


