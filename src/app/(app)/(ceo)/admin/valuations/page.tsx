import { IconFileAnalytics } from "@tabler/icons-react";
import { ModulePage } from "@/components/sunland/module-page";

export default function ValuationsPage() {
  return (
    <ModulePage
      action="Create valuation"
      description="Track valuation instructions, inspection dates, report preparation, delivery, fee collection, and uploads."
      emptyDescription="Valuation work will appear here once a valuation instruction is created."
      emptyTitle="No valuations yet"
      eyebrow="Advisory"
      icon={IconFileAnalytics}
      title="Valuations"
    />
  );
}
