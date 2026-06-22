import { LedgerAccountsBoard } from "@/components/finance/ledger-accounts-board";
import { assertFinanceTab } from "@/components/finance/finance-route-tools";

export default async function LedgerTabPage({
  params,
}: {
  params: Promise<{ tab: string }>;
}) {
  const { tab } = await params;
  assertFinanceTab("ledger", tab);

  return <LedgerAccountsBoard tabId={tab} />;
}
