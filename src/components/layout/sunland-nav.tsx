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
  IconKeyboard,
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
import { Avatar } from "@/components/ui/avatar";
import { ENTITIES, getEntityById } from "@/data/entities";
const TEAM_MEMBERS = [
  {
    id: 1,
    name: "Esther Howard",
    role: "Property Manager",
    status: "online" as const,
    avatarUrl: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=80&h=80&fit=crop&crop=face",
  },
  {
    id: 2,
    name: "Jacob Jones",
    role: "Sales Agent",
    status: "away" as const,
    avatarUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=80&h=80&fit=crop&crop=face",
  },
  {
    id: 3,
    name: "Cody Fisher",
    role: "Accounts Officer",
    status: "online" as const,
    avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&h=80&fit=crop&crop=face",
  },
];

const USER = {
  name: "Paul Amos",
  email: "ceo@sunlandre.co.ke",
  role: "CEO",
  avatarUrl: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=80&h=80&fit=crop&crop=face",
};

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
          "px-2.5 py-1.5 text-[12px] font-medium text-white/90 shadow-xl backdrop-blur-2xl",
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
      <p className="px-2 pb-1.5 pt-1 text-[10px] uppercase tracking-widest text-white/30">
        {section.label}
      </p>
      {section.items.map((item) => {
        const isActive = activeHref === item.href;
        const ItemIcon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            role="menuitem"
            className={cn(
              "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] transition-colors",
              isActive
                ? "bg-white/[0.08] text-white"
                : "text-white/65 hover:bg-white/[0.05] hover:text-white/90",
            )}
          >
            <ItemIcon size={14} stroke={1.5} className="shrink-0 opacity-65" aria-hidden />
            {item.label}
            {isActive && <IconCheck size={12} className="ml-auto text-white/50" aria-hidden />}
          </Link>
        );
      })}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function SunlandNav() {
  const pathname = usePathname();
  const {
    activeSidebarSection,
    sidebarCollapsed,
    setActiveSidebarSection,
    toggleSidebar,
    activeEntityId,
    setSwitchingToEntityId,
  } = useUIStore();

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
    setIsSwitcherOpen(false);
    setIsProfileOpen(false);
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
          aria-label="Sunland CRM dashboard"
          className="focus-ring flex items-center gap-3 rounded-xl p-2 transition hover:bg-white/[0.03]"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.07] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition">
            <IconBuildingCommunity aria-hidden size={18} stroke={1.5} />
          </span>
          <AnimatePresence>
            {!sidebarCollapsed && (
              <motion.div
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -6 }}
                transition={{ duration: 0.18 }}
                className="min-w-0"
              >
                <p className="text-[13.5px] font-medium leading-tight tracking-tight text-white/90">
                  Sunland CRM
                </p>
                <p className="text-[10px] font-medium uppercase tracking-widest text-white/35">
                  Estate Intelligence
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </Link>

        {/* Line separator above entity switcher */}
        <div className="my-3 h-px bg-white/[0.05]" />

        {/* Entity Switcher */}
        <div className="relative mt-2" ref={switcherRef}>
          <button
            type="button"
            aria-haspopup="listbox"
            aria-expanded={isSwitcherOpen}
            aria-label="Switch entity"
            onClick={() => { setIsSwitcherOpen((v) => !v); setIsProfileOpen(false); }}
            className={cn(
              "focus-ring flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left transition-colors",
              isSwitcherOpen ? "bg-white/[0.06]" : "hover:bg-white/[0.03]",
              sidebarCollapsed && "justify-center",
            )}
          >
            <Avatar
              src={activeEntity.avatarUrl}
              fallback={activeEntity.name.substring(0, 2)}
              shape="rounded-lg"
              className="size-7 shrink-0"
            />
            <AnimatePresence>
              {!sidebarCollapsed && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="flex flex-1 items-center justify-between min-w-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[12.5px] font-medium text-white/85">{activeEntity.name}</p>
                    <p className="truncate text-[10.5px] text-white/35">{activeEntity.subtitle}</p>
                  </div>
                  <IconChevronDown
                    size={13}
                    className={cn("shrink-0 text-white/25 transition-transform duration-200", isSwitcherOpen && "rotate-180")}
                    aria-hidden
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </button>

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
                  <p className="px-2 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-widest text-white/30">
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
                          <p className="truncate text-[10.5px] text-white/35">{entity.subtitle}</p>
                        </div>
                        {isActive && <IconCheck size={13} className="shrink-0 text-white/40" aria-hidden />}
                      </button>
                    );
                  })}
                </div>
                <div className="border-t border-white/[0.04] p-1">
                  <button
                    type="button"
                    className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-[10.5px] text-white/35 transition-colors hover:bg-white/[0.04] hover:text-white/60"
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
        {/* MAIN eyebrow */}
        {!sidebarCollapsed && (
          <p className="mb-2 pl-2 label-caps text-white/25 tracking-widest">Main</p>
        )}

        <div className="space-y-0.5">
          {navSections.map((section) => {
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
                  <span className="relative z-10 text-[13.5px]">{section.label}</span>
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
                  <span className="flex-1 text-[13.5px]">{section.label}</span>
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
                        <div className="absolute left-0 top-1 bottom-3 w-px bg-white/[0.06]" />

                        {section.items.map((item) => {
                          const isActive = activeNavItem?.href === item.href;
                          return (
                            <Link
                              key={item.href}
                              href={item.href}
                              className={cn(
                                "focus-ring relative flex h-8 items-center rounded-lg pl-5 pr-3 text-[13px] transition-colors",
                                isActive
                                  ? "text-white"
                                  : "text-white/52 hover:text-white/80",
                              )}
                            >
                              {/* Horizontal connector */}
                              <span className="absolute left-0 top-1/2 -translate-y-1/2 h-px w-3 bg-white/[0.06]" />

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
                                <span className="relative z-10 ml-auto rounded-full bg-white/[0.07] px-2 py-0.5 text-[10px] text-white/50 font-medium">
                                  {item.badge}
                                </span>
                              )}
                            </Link>
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
            {TEAM_MEMBERS.map((member) =>
              sidebarCollapsed ? (
                <NavTooltip key={member.id} label={`${member.name} · ${member.role}`}>
                  <button
                    type="button"
                    aria-label={member.name}
                    className="flex size-10 items-center justify-center rounded-xl transition-colors hover:bg-white/[0.04]"
                  >
                    <Avatar
                      src={member.avatarUrl}
                      fallback={member.name.substring(0, 2)}
                      status={member.status}
                      className="size-8"
                    />
                  </button>
                </NavTooltip>
              ) : (
                <button
                  key={member.id}
                  type="button"
                  aria-label={`Message ${member.name}`}
                  className="group flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 transition-colors hover:bg-white/[0.04]"
                >
                  <Avatar
                    src={member.avatarUrl}
                    fallback={member.name.substring(0, 2)}
                    status={member.status}
                    className="size-8 shrink-0"
                  />
                  <div className="min-w-0 text-left">
                    <p className="truncate text-[13px] text-white/75 group-hover:text-white/95 transition-colors">
                      {member.name}
                    </p>
                    <p className="truncate text-[11px] text-white/40">{member.role}</p>
                  </div>
                </button>
              ),
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
                  src={USER.avatarUrl}
                  fallback="DM"
                  status="online"
                  className="size-8 shrink-0 mt-0.5"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] text-white/92">{USER.name}</p>
                  <p className="truncate text-[11.5px] text-white/50">{USER.email}</p>
                </div>
                <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-white/45 mt-0.5 shrink-0">
                  {USER.role}
                </span>
              </div>

              {/* Actions */}
              <div className="p-1">
                <ProfileMenuItem icon={IconUserCircle} label="My Profile" />
                <ProfileMenuItem icon={IconSettings} label="Preferences" />
                <ProfileMenuItem icon={IconUsersGroup} label="Team Members" />
                <ProfileMenuItem icon={IconShield} label="Security & Access" />
                <ProfileMenuItem icon={IconKeyboard} label="Keyboard Shortcuts" />
                <ProfileMenuItem icon={IconHelp} label="Help & Support" />
              </div>

              {/* Log out */}
              <div className="border-t border-white/[0.05] p-1">
                <button
                  type="button"
                  style={{ fontSize: '13px' }}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 transition-colors",
                    "text-[var(--error)] hover:bg-[var(--error)]/10 hover:text-red-300",
                  )}
                >
                  <IconLogout size={14} aria-hidden />
                  Log out of Sunland CRM
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Profile trigger button */}
        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={isProfileOpen}
          aria-label="Open account menu"
          onClick={() => { setIsProfileOpen((v) => !v); setIsSwitcherOpen(false); }}
          className={cn(
            "focus-ring flex w-full items-center gap-3 rounded-xl transition-colors hover:bg-white/[0.04]",
            isProfileOpen && "bg-white/[0.05]",
            sidebarCollapsed ? "justify-center p-1.5" : "p-2",
          )}
        >
          <Avatar
            src={USER.avatarUrl}
            fallback="DM"
            status="online"
            className="size-9 shrink-0"
          />
          <AnimatePresence>
            {!sidebarCollapsed && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="flex flex-1 items-start justify-between min-w-0"
              >
                <div className="min-w-0">
                  <p className="truncate text-[13.5px] text-white/92">{USER.name}</p>
                  <p className="truncate text-[10.5px] text-white/45 uppercase tracking-wider">{USER.role}</p>
                </div>
                <IconChevronDown
                  size={13}
                  aria-hidden
                  className={cn("shrink-0 text-white/25 transition-transform duration-200 mt-0.5", isProfileOpen && "rotate-180")}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </button>
      </div>
    </aside>
  );
}

// ─── Profile menu item helper ─────────────────────────────────────────────────

function ProfileMenuItem({ icon: ItemIcon, label }: { icon: Icon; label: string }) {
  return (
    <button
      type="button"
      style={{ fontSize: '13px' }}
      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-white/68 transition-colors hover:bg-white/[0.05] hover:text-white/92"
    >
      <ItemIcon size={14} aria-hidden className="shrink-0 opacity-65" />
      {label}
    </button>
  );
}