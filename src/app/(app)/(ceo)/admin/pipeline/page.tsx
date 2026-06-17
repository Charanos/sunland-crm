import { IconChartBar } from "@tabler/icons-react";
import { ModulePage } from "@/components/sunland/module-page";

export default function PipelinePage() {
  return (
    <ModulePage
      action="Create lead"
      description="Move opportunities through inquiry, qualification, viewing, offer, negotiation, closure, and commission tracking."
      emptyDescription="Open leads and opportunity stages will appear once the BD team starts logging enquiries."
      emptyTitle="No pipeline activity"
      eyebrow="Business development"
      icon={IconChartBar}
      title="Pipeline"
    />
  );
}
