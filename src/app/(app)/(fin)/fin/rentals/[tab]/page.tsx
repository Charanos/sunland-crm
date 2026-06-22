import { RentalsLedgerBoard } from "@/components/finance/rentals-ledger-board";
import { assertFinanceTab } from "@/components/finance/finance-route-tools";

export default async function RentalsTabPage({
  params,
}: {
  params: Promise<{ tab: string }>;
}) {
  const { tab } = await params;
  assertFinanceTab("rentals", tab);

  return <RentalsLedgerBoard tabId={tab} />;
}
