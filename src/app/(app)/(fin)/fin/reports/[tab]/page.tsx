import { FinancePageScaffold } from "@/components/finance/finance-page-scaffold";
import { assertFinanceTab } from "@/components/finance/finance-route-tools";

export default async function ReportsTabPage({
  params,
}: {
  params: Promise<{ tab: string }>;
}) {
  const { tab } = await params;
  assertFinanceTab("reports", tab);

  return <FinancePageScaffold sectionId="reports" tabId={tab} />;
}
