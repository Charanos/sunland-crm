import { IconReportAnalytics } from "@tabler/icons-react";
import { ModulePage } from "@/components/sunland/module-page";

export default function ReportsPage() {
  return (
    <ModulePage
      action="Generate report"
      description="Create operational reports for pipeline performance, occupancy, rent collection, commissions, and audit history."
      emptyDescription="Saved reports and generated exports will appear here."
      emptyTitle="No reports generated"
      eyebrow="Business intelligence"
      icon={IconReportAnalytics}
      title="Reports"
    />
  );
}
