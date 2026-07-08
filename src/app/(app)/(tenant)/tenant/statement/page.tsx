import { ModulePage } from "@/components/sunland/module-page";
import { IconFileText } from "@tabler/icons-react";
export default function TenantStatementPage() {
  return (
    <ModulePage
      eyebrow="My Statement"
      title="Rental Statement"
      description="Your per-period rental statement — expected amount, collected, outstanding balance, and status. Derived directly from the Sunland rental ledger. Downloadable for your records."
      emptyTitle="No statement available"
      emptyDescription="Your rental statement will be available once your first collection period is recorded."
      action="Download Statement"
      icon={IconFileText}
    />
  );
}
