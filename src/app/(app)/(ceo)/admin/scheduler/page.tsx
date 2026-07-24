"use client";

import { Suspense } from "react";
import { useUIStore } from "@/store/ui";
import { PortfolioSchedulerBoard } from "@/components/sunland/portfolio-scheduler-board";

// The unified Operations Scheduler (ADR 019) - Events and Projects modes on
// one surface, with a Personal/Organization scope switcher backed by the
// scheduling service's real `scope: mine | all`.
export default function SchedulerPage() {
  const { activeEntityId } = useUIStore();
  return (
    <Suspense fallback={null}>
      <PortfolioSchedulerBoard entityId={activeEntityId} />
    </Suspense>
  );
}
