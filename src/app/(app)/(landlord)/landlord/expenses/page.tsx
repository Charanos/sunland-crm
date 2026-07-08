import { ModulePage } from "@/components/sunland/module-page";
import { IconReceiptTax } from "@tabler/icons-react";
export default function LandlordExpensesPage() {
  return (
    <ModulePage
      eyebrow="Financials"
      title="Expense Ledger"
      description="Rechargeable expenses deducted from your remittance. Every entry shows category, amount, who logged it, approval status, and evidence. Expense transparency is fundamental to the Sunland mandate relationship."
      emptyTitle="No expenses logged"
      emptyDescription="Approved rechargeable expenses will appear here with full detail � category, amount, approval trail, and evidence attachments."
      action="View Remittance Statements"
      icon={IconReceiptTax}
    />
  );
}
