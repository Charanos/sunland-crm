import { create } from "zustand";
import type { PipelineStage } from "@/types";

type PipelineStore = {
  activeStage: PipelineStage | "all";
  selectedLeadId: string | null;
  setStage: (stage: PipelineStage | "all") => void;
  setSelectedLead: (id: string | null) => void;
};

export const usePipelineStore = create<PipelineStore>((set) => ({
  activeStage: "all",
  selectedLeadId: null,
  setStage: (stage) => set({ activeStage: stage }),
  setSelectedLead: (id) => set({ selectedLeadId: id }),
}));
