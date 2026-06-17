import { IconTool } from "@tabler/icons-react";
import { ModulePage } from "@/components/sunland/module-page";

export default function MaintenancePage() {
  return (
    <ModulePage
      action="Log request"
      description="Prioritize maintenance issues by property, contractor, urgency, age, and resolution status."
      emptyDescription="Open maintenance requests will appear here with their current assignment and risk level."
      emptyTitle="No maintenance queue"
      eyebrow="Operations"
      icon={IconTool}
      title="Maintenance"
    />
  );
}
