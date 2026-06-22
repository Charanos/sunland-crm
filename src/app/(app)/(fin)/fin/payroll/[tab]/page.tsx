import { FinancePageScaffold } from "@/components/finance/finance-page-scaffold";
import { assertFinanceTab } from "@/components/finance/finance-route-tools";

export default async function PayrollTabPage({
  params,
}: {
  params: Promise<{ tab: string }>;
}) {
  const { tab } = await params;
  assertFinanceTab("payroll", tab);

  return <FinancePageScaffold sectionId="payroll" tabId={tab} />;
}
