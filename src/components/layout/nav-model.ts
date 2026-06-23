import type { Icon } from "@tabler/icons-react";
import {
  IconBell,
  IconBuildingBank,
  IconBuildingCommunity,
  IconCalendarDollar,
  IconCashBanknote,
  IconChartBar,
  IconClipboardCheck,
  IconClipboardList,
  IconFileAnalytics,
  IconHomeDollar,
  IconHomeStats,
  IconReportAnalytics,
  IconSettings,
  IconShieldLock,
  IconTool,
  IconUserCog,
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

export const navSections: NavSection[] = [
  {
    id: "command",
    label: "Command",
    icon: IconHomeStats,
    items: [{ href: "/admin", label: "Overview", icon: IconHomeStats }],
  },
  {
    id: "finance-command",
    label: "Finance Command",
    icon: IconChartBar,
    items: [
      { href: "/fin", label: "Overview", icon: IconChartBar },
    ],
  },
  {
    id: "finance-core",
    label: "Core Accounting",
    icon: IconWallet,
    items: [
      { href: "/fin/ledger", label: "Ledger & Accounts", icon: IconWallet, badge: "1" },
    ],
  },
  {
    id: "finance-revenue",
    label: "Property Revenue",
    icon: IconHomeDollar,
    items: [
      { href: "/fin/rentals", label: "Rentals", icon: IconHomeDollar, badge: "12" },
      { href: "/fin/mandates", label: "Mandates", icon: IconClipboardCheck, badge: "3" },
      { href: "/fin/fees", label: "Service Fees", icon: IconCashBanknote },
    ],
  },
  {
    id: "finance-treasury",
    label: "Treasury Control",
    icon: IconBuildingBank,
    items: [
      { href: "/fin/ap-ar", label: "Payables & Receivables", icon: IconClipboardList, badge: "2" },
      { href: "/fin/cheques", label: "Cheques", icon: IconBuildingBank, badge: "1" },
    ],
  },
  {
    id: "finance-people",
    label: "People & Statutory",
    icon: IconUsersGroup,
    items: [
      { href: "/fin/payroll", label: "Payroll", icon: IconUsersGroup },
      { href: "/fin/commissions", label: "Commissions & WHT", icon: IconCashBanknote },
    ],
  },
  {
    id: "finance-assurance",
    label: "Finance Assurance",
    icon: IconFileAnalytics,
    items: [
      { href: "/fin/reports", label: "Reports", icon: IconReportAnalytics },
    ],
  },
  {
    id: "operations",
    label: "Operations",
    icon: IconClipboardList,
    items: [
      { href: "/admin/contacts", label: "Contacts", icon: IconUsersGroup },
      { href: "/admin/pipeline", label: "Pipeline", icon: IconChartBar },
      { href: "/admin/leases", label: "Leases", icon: IconCalendarDollar },
      { href: "/admin/maintenance", label: "Maintenance", icon: IconTool },
    ],
  },
  {
    id: "portfolio",
    label: "Portfolio",
    icon: IconBuildingCommunity,
    items: [
      { href: "/admin/properties", label: "Properties", icon: IconBuildingCommunity },
      { href: "/admin/valuations", label: "Valuations", icon: IconFileAnalytics },
    ],
  },
  {
    id: "admin",
    label: "Admin",
    icon: IconUserCog,
    items: [
      { href: "/admin/settings", label: "Settings", icon: IconSettings },
      { href: "/admin/notifications", label: "Notifications", icon: IconBell },
      { href: "/admin/security", label: "Security", icon: IconShieldLock },
    ],
  },
];

const findNavItem = (secId: string, href: string) => {
  const sec = navSections.find((s) => s.id === secId);
  return sec?.items.find((i) => i.href === href);
};

export const mobilePrimaryNav = [
  findNavItem("command", "/admin"),
  findNavItem("operations", "/admin/contacts"),
  findNavItem("finance-command", "/fin"),
  findNavItem("finance-revenue", "/fin/rentals"),
  findNavItem("portfolio", "/admin/properties"),
].filter((item): item is NavItem => !!item);

export const collapsedNavItems = [
  findNavItem("command", "/admin"),
  findNavItem("operations", "/admin/contacts"),
  findNavItem("finance-command", "/fin"),
  findNavItem("finance-core", "/fin/ledger"),
  findNavItem("finance-revenue", "/fin/rentals"),
  findNavItem("finance-treasury", "/fin/ap-ar"),
  findNavItem("portfolio", "/admin/properties"),
].filter((item): item is NavItem => !!item);

export function getActiveNavItem(pathname: string): NavItem | null {
  const allItems = navSections.flatMap((section) => section.items);
  const matches = allItems.filter((item) =>
    item.href === "/admin" || item.href === "/fin"
      ? pathname === item.href
      : pathname.startsWith(item.href),
  );

  if (matches.length === 0) return null;

  // Return the one with the longest href (most specific match)
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
