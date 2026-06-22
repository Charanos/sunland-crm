import { FinancePageScaffold } from "@/components/finance/finance-page-scaffold";
import { assertFinanceTab } from "@/components/finance/finance-route-tools";

export default async function AffordableHousingTabPage({
  params,
}: {
  params: Promise<{ tab: string }>;
}) {
  const { tab } = await params;
  assertFinanceTab("affordable-housing", tab);

  return <FinancePageScaffold sectionId="affordable-housing" tabId={tab} />;
}
