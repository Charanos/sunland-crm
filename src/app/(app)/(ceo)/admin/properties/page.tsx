"use client";

import { useUIStore } from "@/store/ui";
import { PropertiesBoard } from "@/components/sunland/properties-board";

export default function PropertiesPage() {
  const { activeEntityId } = useUIStore();

  return <PropertiesBoard entityId={activeEntityId} />;
}
