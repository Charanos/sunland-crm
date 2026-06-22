import { AffordableHousingBoard } from "@/components/finance/affordable-housing-board";
import { assertFinanceTab } from "@/components/finance/finance-route-tools";

export default async function AffordableHousingTabPage({
  params,
}: {
  params: Promise<{ tab: string }>;
}) {
  const { tab } = await params;
  assertFinanceTab("affordable-housing", tab);

  return <AffordableHousingBoard tabId={tab} />;
}
