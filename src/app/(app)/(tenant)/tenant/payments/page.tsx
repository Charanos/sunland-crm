import { ModulePage } from "@/components/sunland/module-page";
import { IconReceiptDollar } from "@tabler/icons-react";
export default function TenantPaymentsPage() {
  return (
    <ModulePage
      eyebrow="Rent & Payments"
      title="Payments"
      description="Pay your rent and view your complete payment receipt history. Payments are processed and confirmed against the Sunland Finance ledger — you will receive a receipt once confirmed."
      emptyTitle="No payments recorded"
      emptyDescription="Your payment history will appear here once your first rent payment is confirmed."
      action="Pay Rent"
      icon={IconReceiptDollar}
    />
  );
}
