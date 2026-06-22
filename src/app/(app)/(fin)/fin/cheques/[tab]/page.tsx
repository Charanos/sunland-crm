import { ChequesClearanceBoard } from "@/components/finance/cheques-clearance-board";
import { assertFinanceTab } from "@/components/finance/finance-route-tools";

export default async function ChequesTabPage({
  params,
}: {
  params: Promise<{ tab: string }>;
}) {
  const { tab } = await params;
  assertFinanceTab("cheques", tab);

  return <ChequesClearanceBoard tabId={tab} />;
}
