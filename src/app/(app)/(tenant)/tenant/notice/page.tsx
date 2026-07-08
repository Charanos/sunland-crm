import { ModulePage } from "@/components/sunland/module-page";
import { IconMessageCircle } from "@tabler/icons-react";
export default function TenantNoticePage() {
  return (
    <ModulePage
      eyebrow="Move-Out Notice"
      title="Transfer & Move-Out Notice"
      description="Give formal notice of your intention to vacate. Your notice triggers coordinated workflows: Finance (deposit reconciliation), Operations (inspection), and Business Development (re-letting). Deposit refund options are presented during the notice process."
      emptyTitle="No notice submitted"
      emptyDescription="Submit a move-out notice here when you are ready to vacate. Your notice period is specified in your lease terms."
      action="Submit Notice"
      icon={IconMessageCircle}
    />
  );
}
