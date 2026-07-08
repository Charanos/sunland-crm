import { ModulePage } from "@/components/sunland/module-page";
import { IconTool } from "@tabler/icons-react";
export default function TenantMaintenancePage() {
  return (
    <ModulePage
      eyebrow="Maintenance"
      title="Complaints & Maintenance"
      description="Raise a maintenance request or track the status of an existing complaint. Requests are routed to Sunland Front Office and Operations � you will be notified at each status change."
      emptyTitle="No maintenance requests"
      emptyDescription="You have no open or past maintenance requests. Use the button below to raise a new complaint."
      action="Raise Complaint"
      icon={IconTool}
    />
  );
}
