import { create } from "zustand";

type ModalType =
  | "create-property"
  | "edit-property"
  | "create-event"
  | "edit-event"
  | "delete-confirm"
  | null;

type UIStore = {
  sidebarCollapsed: boolean;
  mobileNavOpen: boolean;
  activeSidebarSection: string;
  activeDrawer: string | null;
  activeEntityId: string;
  switchingToEntityId: string | null;
  // Dashboard-level state
  activeModal: ModalType;
  selectedRecordId: string | null;
  selectedRecordType: string | null;
  dashboardLoading: boolean;
  // Actions
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  openMobileNav: () => void;
  closeMobileNav: () => void;
  setActiveSidebarSection: (section: string) => void;
  openDrawer: (id: string) => void;
  closeDrawer: () => void;
  setActiveEntityId: (id: string) => void;
  setSwitchingToEntityId: (id: string | null) => void;
  openModal: (type: ModalType, recordId?: string | null, recordType?: string | null) => void;
  closeModal: () => void;
  setDashboardLoading: (loading: boolean) => void;
};

export const useUIStore = create<UIStore>((set) => ({
  sidebarCollapsed: false,
  mobileNavOpen: false,
  activeSidebarSection: "command",
  activeDrawer: null,
  activeEntityId: "group",
  switchingToEntityId: null,
  activeModal: null,
  selectedRecordId: null,
  selectedRecordType: null,
  dashboardLoading: false,
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
  openModal: (type, recordId = null, recordType = null) =>
    set({
      activeModal: type,
      selectedRecordId: recordId,
      selectedRecordType: recordType,
    }),
  closeModal: () =>
    set({ activeModal: null, selectedRecordId: null, selectedRecordType: null }),
  setDashboardLoading: (loading) => set({ dashboardLoading: loading }),
}));
