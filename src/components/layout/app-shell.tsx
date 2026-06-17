"use client";

import { MobileBottomNav, MobileNavigationDrawer } from "@/components/layout/mobile-nav";
import { SunlandNav } from "@/components/layout/sunland-nav";
import { TopNav } from "@/components/layout/top-nav";
import { EntitySwitchOverlay } from "@/components/layout/entity-switch-overlay";
import { cn } from "@/lib/utils/cn";
import { useUIStore } from "@/store/ui";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { sidebarCollapsed } = useUIStore();

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <SunlandNav />
      <MobileNavigationDrawer />
      <div
        className={cn(
          "min-h-screen transition-[padding] duration-300 ease-out lg:pl-[272px]",
          sidebarCollapsed && "lg:pl-[72px]",
        )}
      >
        <TopNav />
        <main className="px-4 pb-28 pt-2 sm:px-6 lg:px-8 lg:pb-8">
          {children}
        </main>
      </div>
      <MobileBottomNav />
      <EntitySwitchOverlay />
    </div>
  );
}

