"use client";

import { Suspense } from "react";
import { useUIStore } from "@/store/ui";
import { PropertiesBoard } from "@/components/sunland/properties-board";

function PropertiesPageContent() {
  const { activeEntityId } = useUIStore();
  return <PropertiesBoard entityId={activeEntityId} />;
}

export default function PropertiesPage() {
  return (
    <Suspense>
      <PropertiesPageContent />
    </Suspense>
  );
}
