import { CommissionsBoard } from "@/components/finance/commissions-board";
import { assertFinanceTab } from "@/components/finance/finance-route-tools";

export default async function CommissionsTabPage({
  params,
}: {
  params: Promise<{ tab: string }>;
}) {
  const { tab } = await params;
  assertFinanceTab("commissions", tab);

  return <CommissionsBoard tabId={tab} />;
}
