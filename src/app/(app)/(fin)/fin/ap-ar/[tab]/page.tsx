import { PayablesReceivablesBoard } from "@/components/finance/payables-receivables-board";
import { assertFinanceTab } from "@/components/finance/finance-route-tools";

export default async function ApArTabPage({
  params,
}: {
  params: Promise<{ tab: string }>;
}) {
  const { tab } = await params;
  assertFinanceTab("ap-ar", tab);

  return <PayablesReceivablesBoard tabId={tab} />;
}
