import { create } from "zustand";

type UIStore = {
  sidebarCollapsed: boolean;
  mobileNavOpen: boolean;
  activeSidebarSection: string;
  activeDrawer: string | null;
  activeEntityId: string;
  switchingToEntityId: string | null;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  openMobileNav: () => void;
  closeMobileNav: () => void;
  setActiveSidebarSection: (section: string) => void;
  openDrawer: (id: string) => void;
  closeDrawer: () => void;
  setActiveEntityId: (id: string) => void;
  setSwitchingToEntityId: (id: string | null) => void;
};

export const useUIStore = create<UIStore>((set) => ({
  sidebarCollapsed: false,
  mobileNavOpen: false,
  activeSidebarSection: "command",
  activeDrawer: null,
  activeEntityId: "group",
  switchingToEntityId: null,
  toggleSidebar: () =>
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  openMobileNav: () => set({ mobileNavOpen: true }),
  closeMobileNav: () => set({ mobileNavOpen: false }),
  setActiveSidebarSection: (section) => set({ activeSidebarSection: section }),
  openDrawer: (id) => set({ activeDrawer: id }),
  closeDrawer: () => set({ activeDrawer: null }),
  setActiveEntityId: (id) => set({ activeEntityId: id }),
  setSwitchingToEntityId: (id) => set({ switchingToEntityId: id }),
}));

