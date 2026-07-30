"use client";

import { Suspense } from "react";
import { useUIStore } from "@/store/ui";
import { OversightBoard } from "@/components/sunland/oversight-board";

// Renders the Oversight Console at its own section (ADR 020). Each Oversight
// route keeps a real pathname because the sidebar matches the active item on
// pathname and query strings are dropped - the ADR 019 routing rule.
export default function OversightSectionPage() {
  const { activeEntityId } = useUIStore();
  return (
    <Suspense fallback={null}>
      <OversightBoard entityId={activeEntityId} startSection="approvals" />
    </Suspense>
  );
}
