"use client";

import { useUIStore } from "@/store/ui";
import { ValuationsFocusBoard } from "@/components/sunland/valuations-focus-board";

export default function ValuationsKanbanPage() {
  const { activeEntityId } = useUIStore();

  return <ValuationsFocusBoard entityId={activeEntityId} />;
}
