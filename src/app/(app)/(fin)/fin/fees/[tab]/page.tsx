import { ServiceFeesBoard } from "@/components/finance/service-fees-board";
import { assertFinanceTab } from "@/components/finance/finance-route-tools";

export default async function FeesTabPage({
  params,
}: {
  params: Promise<{ tab: string }>;
}) {
  const { tab } = await params;
  assertFinanceTab("fees", tab);

  return <ServiceFeesBoard tabId={tab} />;
}
