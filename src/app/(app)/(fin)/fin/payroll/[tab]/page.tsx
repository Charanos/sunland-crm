import { PayrollBoard } from "@/components/finance/payroll-board";
import { assertFinanceTab } from "@/components/finance/finance-route-tools";

export default async function PayrollTabPage({
  params,
}: {
  params: Promise<{ tab: string }>;
}) {
  const { tab } = await params;
  assertFinanceTab("payroll", tab);

  return <PayrollBoard tabId={tab} />;
}
