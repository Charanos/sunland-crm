import { FinanceAssuranceBoard } from "@/components/finance/finance-assurance-board";
import { assertFinanceTab } from "@/components/finance/finance-route-tools";

export default async function ReportsTabPage({
  params,
}: {
  params: Promise<{ tab: string }>;
}) {
  const { tab } = await params;
  assertFinanceTab("reports", tab);

  return <FinanceAssuranceBoard tabId={tab} />;
}
