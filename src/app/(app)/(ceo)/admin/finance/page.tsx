import { IconWallet } from "@tabler/icons-react";
import { ModulePage } from "@/components/sunland/module-page";

export default function FinancePage() {
  return (
    <ModulePage
      action="Record payment"
      description="Monitor rent collection, commissions, transaction approvals, arrears, owner statements, and monthly revenue."
      emptyDescription="Finance entries will appear here after accounts records the first transaction."
      emptyTitle="No finance records"
      eyebrow="Accounts"
      icon={IconWallet}
      title="Finance"
    />
  );
}
