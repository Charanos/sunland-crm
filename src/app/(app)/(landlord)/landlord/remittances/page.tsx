import { ModulePage } from "@/components/sunland/module-page";
import { IconCurrencyDollar } from "@tabler/icons-react";
export default function LandlordRemittancesPage() {
  return (
    <ModulePage
      eyebrow="Financials"
      title="Remittance Statements"
      description="Per-period statements showing collected rent, management fee deduction, approved expenses, and net remittance. Every figure traces to the Sunland Finance ledger � downloadable with QR verification."
      emptyTitle="No remittances yet"
      emptyDescription="Remittance statements will appear here once your first collection period closes. Each statement is derived from the Finance ledger � not a separate copy."
      action="View Mandate Terms"
      icon={IconCurrencyDollar}
    />
  );
}
