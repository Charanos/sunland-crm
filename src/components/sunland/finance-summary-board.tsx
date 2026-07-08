"use client";

import {
  IconCash,
  IconArrowRight,
} from "@tabler/icons-react";
import { ModulePage } from "@/components/sunland/module-page";
import { useRouter } from "next/navigation";

export function FinanceSummaryBoard() {
  const router = useRouter();

  return (
    <div className="mx-auto flex max-w-[98rem] flex-col gap-6" onClick={() => router.push("/fin")}>
      <ModulePage
        action="Go to Finance Module"
        description="Executive summary of the Finance department. Click the button to enter the full Finance operational module."
        emptyDescription="This is a placeholder for the Executive Finance Summary dashboard. High-level financial KPIs and charts will be displayed here."
        emptyTitle="Finance Summary Dashboard"
        eyebrow="Departments"
        icon={IconCash}
        title="Finance Summary"
      />
    </div>
  );
}
