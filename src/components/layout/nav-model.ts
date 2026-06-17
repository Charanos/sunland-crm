import type { Icon } from "@tabler/icons-react";
import {
  IconBell,
  IconBuildingCommunity,
  IconCalendarDollar,
  IconChartBar,
  IconClipboardList,
  IconFileAnalytics,
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
    id: "finance",
    label: "Finance",
    icon: IconWallet,
    items: [
      { href: "/admin/finance", label: "Transactions", icon: IconWallet },
      { href: "/admin/reports", label: "Reports", icon: IconReportAnalytics },
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

export const mobilePrimaryNav = [
  navSections[0].items[0],
  navSections[1].items[0],
  navSections[1].items[1],
  navSections[2].items[0],
  navSections[3].items[0],
];

export const collapsedNavItems = [
  navSections[0].items[0],
  navSections[1].items[0],
  navSections[1].items[1],
  navSections[2].items[0],
  navSections[3].items[0],
  navSections[4].items[0],
];

export function getActiveNavItem(pathname: string): NavItem | null {
  const allItems = navSections.flatMap((section) => section.items);
  const matches = allItems.filter((item) =>
    item.href === "/admin"
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
