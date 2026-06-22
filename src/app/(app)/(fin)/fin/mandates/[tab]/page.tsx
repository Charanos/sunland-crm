import { PropertyMandatesBoard } from "@/components/finance/property-mandates-board";
import { assertFinanceTab } from "@/components/finance/finance-route-tools";

export default async function MandatesTabPage({
  params,
}: {
  params: Promise<{ tab: string }>;
}) {
  const { tab } = await params;
  assertFinanceTab("mandates", tab);

  return <PropertyMandatesBoard tabId={tab} />;
}
