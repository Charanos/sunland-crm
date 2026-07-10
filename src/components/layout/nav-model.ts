import type { Icon } from "@tabler/icons-react";
import {
  IconAlertTriangle,
  IconApps,
  IconBell,
  IconBriefcase,
  IconBuildingBank,
  IconBuildingCommunity,
  IconCalendarDollar,
  IconCalendarEvent,
  IconCash,
  IconCashBanknote,
  IconChartBar,
  IconChecklist,
  IconClipboardCheck,
  IconClipboardList,
  IconDatabase,
  IconFileAnalytics,
  IconHomeDollar,
  IconHomeStats,
  IconLayoutKanban,
  IconLifebuoy,
  IconMessageCircle,
  IconReportAnalytics,
  IconSettings,
  IconShieldLock,
  IconTool,
  IconUserCog,
  IconUsers,
  IconUsersGroup,
  IconWallet,
} from "@tabler/icons-react";

export type NavItem = {
  href: string;
  label: string;
  icon: Icon;
  badge?: string;
  group?: string;
};

export type NavSection = {
  id: string;
  label: string;
  icon: Icon;
  items: NavItem[];
};

// ─── FINANCE PORTAL sections (shown when pathname starts with /fin) ──────────
// Section IDs all start with "fin-" so the sidebar filter can correctly scope them.

export const navSections: NavSection[] = [
  // ── Finance: Command (single flat link) ────────────────────────────────────
  {
    id: "fin-command",
    label: "Finance Command",
    icon: IconChartBar,
    items: [{ href: "/fin", label: "Overview", icon: IconChartBar }],
  },

  // ── Finance: Core Accounting ───────────────────────────────────────────────
  {
    id: "fin-core-accounting",
    label: "Core Accounting",
    icon: IconWallet,
    items: [
      {
        href: "/fin/ledger/journal-entries",
        label: "Ledger & Accounts",
        icon: IconWallet,
        badge: "1",
      },
    ],
  },

  // ── Finance: Property Revenue ──────────────────────────────────────────────
  {
    id: "fin-property-revenue",
    label: "Property Revenue",
    icon: IconHomeDollar,
    items: [
      { href: "/fin/rentals/collections", label: "Rentals", icon: IconHomeDollar, badge: "12" },
      { href: "/fin/mandates/active", label: "Mandates", icon: IconClipboardCheck, badge: "3" },
      { href: "/fin/fees/rules", label: "Service Fees", icon: IconCashBanknote },
    ],
  },

  // ── Finance: Treasury Control ──────────────────────────────────────────────
  {
    id: "fin-treasury-control",
    label: "Treasury Control",
    icon: IconBuildingBank,
    items: [
      {
        href: "/fin/ap-ar/payables",
        label: "Payables & Receivables",
        icon: IconClipboardList,
        badge: "2",
      },
      { href: "/fin/cheques/deposited", label: "Cheques", icon: IconBuildingBank, badge: "1" },
    ],
  },

  // ── Finance: People & Statutory ───────────────────────────────────────────
  {
    id: "fin-people-statutory",
    label: "People & Statutory",
    icon: IconUsersGroup,
    items: [
      { href: "/fin/payroll/runs", label: "Payroll", icon: IconUsersGroup },
      { href: "/fin/commissions/deals", label: "Commissions & WHT", icon: IconCashBanknote },
    ],
  },

  // ── Finance: Assurance (single flat link) ─────────────────────────────────
  {
    id: "fin-assurance",
    label: "Finance Assurance",
    icon: IconFileAnalytics,
    items: [
      {
        href: "/fin/reports/generate",
        label: "Reports",
        icon: IconReportAnalytics,
      },
    ],
  },

  // ─── EXECUTIVE / CEO PORTAL sections (shown on /admin routes) ──────────────
  // Section IDs all start with "exec-" — none start with "fin-".

  // ── Executive: Command (single flat link) ─────────────────────────────────
  {
    id: "exec-command",
    label: "Executive Overview",
    icon: IconHomeStats,
    items: [{ href: "/admin", label: "Overview", icon: IconHomeStats }],
  },

  // ── Executive: Oversight ──────────────────────────────────────────────────
  // /admin/system is gated CEO-only via canAccess() in sunland-nav.tsx
  {
    id: "exec-oversight",
    label: "Oversight",
    icon: IconChecklist,
    items: [
      { href: "/admin/approvals", label: "Approvals Queue", icon: IconChecklist, badge: "9" },
      { href: "/admin/hr/complaints", label: "Complaints", icon: IconAlertTriangle },
      // Triage function, not personal self-service — the admin dashboard is the
      // main technical-support endpoint, so ticket triage lives with the rest
      // of executive oversight, not under Account & System.
      { href: "/admin/support", label: "Support Tickets", icon: IconLifebuoy },
      { href: "/admin/reports", label: "Reports Center", icon: IconReportAnalytics },
      { href: "/admin/system", label: "System Administration", icon: IconDatabase },
    ],
  },

  // ── Executive: Sales & CRM ─────────────────────────────────────────────────
  {
    id: "exec-sales",
    label: "Sales & CRM",
    icon: IconBriefcase,
    items: [
      { href: "/admin/contacts", label: "Contacts", icon: IconUsersGroup },
      { href: "/admin/pipeline", label: "Pipeline", icon: IconChartBar },
    ],
  },

  // ── Executive: Property Portfolio ─────────────────────────────────────────
  // Properties, Leases, Maintenance, and Valuations are one ecosystem — the
  // same portfolio viewed as inventory, tenancy, upkeep, and advisory value.
  // Previously split across two groups (Portfolio / Operations); merged since
  // four closely-related items don't need two accordions to hold them.
  {
    id: "exec-portfolio",
    label: "Property Portfolio",
    icon: IconBuildingCommunity,
    items: [
      { href: "/admin/properties", label: "Properties", icon: IconBuildingCommunity },
      { href: "/admin/leases", label: "Leases", icon: IconCalendarDollar },
      { href: "/admin/maintenance", label: "Maintenance", icon: IconTool },
      { href: "/admin/valuations", label: "Valuations", icon: IconFileAnalytics },
    ],
  },

  // ── Executive: Scheduling ──────────────────────────────────────────────────
  {
    id: "exec-scheduling",
    label: "Scheduling",
    icon: IconLayoutKanban,
    items: [
      { href: "/admin/projects", label: "Projects", icon: IconLayoutKanban },
      { href: "/admin/events", label: "Events", icon: IconCalendarEvent },
    ],
  },

  // ── Executive: Departments (cross-portal links) ───────────────────────────
  {
    id: "exec-departments",
    label: "Departments",
    icon: IconApps,
    items: [
      { label: "Finance", href: "/admin/finance", icon: IconCash, group: "Internal Portals" },
      { href: "/admin/hr", label: "Human Resources", icon: IconUsers, group: "Internal Portals" },
      { href: "/admin/front-office", label: "Front Office", icon: IconBriefcase, group: "Internal Portals" },
    ],
  },

  // ── Executive: Account & System (self-service — kept for non-fin /admin routes) ──
  // NOTE: Self-service links in the nav remain here for the CEO/admin portal.
  // Finance portal self-service is handled exclusively by the profile footer popup.
  {
    id: "exec-account",
    label: "Account & System",
    icon: IconUserCog,
    items: [
      { href: "/admin/messages", label: "Messages", icon: IconMessageCircle, badge: "3" },
      { href: "/admin/settings", label: "Settings", icon: IconSettings },
      { href: "/admin/notifications", label: "Notifications", icon: IconBell },
      { href: "/admin/security", label: "Security", icon: IconShieldLock },
    ],
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const findNavItem = (secId: string, href: string) => {
  const sec = navSections.find((s) => s.id === secId);
  return sec?.items.find((i) => i.href === href);
};

export const mobilePrimaryNav = [
  findNavItem("exec-command", "/admin"),
  findNavItem("exec-sales", "/admin/contacts"),
  findNavItem("fin-command", "/fin"),
  findNavItem("exec-portfolio", "/admin/properties"),
].filter((item): item is NavItem => !!item);

export const collapsedNavItems = [
  findNavItem("exec-command", "/admin"),
  findNavItem("exec-sales", "/admin/contacts"),
  findNavItem("fin-command", "/fin"),
  findNavItem("fin-core-accounting", "/fin/ledger/journal-entries"),
  findNavItem("fin-property-revenue", "/fin/rentals/collections"),
  findNavItem("fin-treasury-control", "/fin/ap-ar/payables"),
  findNavItem("exec-portfolio", "/admin/properties"),
].filter((item): item is NavItem => !!item);

export function getActiveNavItem(pathname: string): NavItem | null {
  const allItems = navSections.flatMap((section) => section.items);

  // Exact-match roots first, then longest startsWith
  const matches = allItems.filter((item) => {
    if (item.href === "/admin" || item.href === "/fin") {
      return pathname === item.href;
    }
    return pathname.startsWith(item.href);
  });

  if (matches.length === 0) return null;
  return matches.sort((a, b) => b.href.length - a.href.length)[0];
}

export function findSectionByPath(pathname: string): NavSection {
  const activeItem = getActiveNavItem(pathname);
  if (!activeItem) return navSections[0];

  return (
    navSections.find((section) =>
      section.items.some((item) => item.href === activeItem.href),
    ) ?? navSections[0]
  );
}
