import { ModulePage } from "@/components/sunland/module-page";
import { IconBuildingCommunity } from "@tabler/icons-react";
export default function LandlordPropertiesPage() {
  return (
    <ModulePage
      eyebrow="Your Portfolio"
      title="Properties & Units"
      description="All properties under your active mandate with Sunland. Occupancy status, current tenants (limited view), and unit details."
      emptyTitle="No properties on mandate"
      emptyDescription="Properties managed under your Sunland mandate will appear here once your mandate is active."
      action="View Mandate Terms"
      icon={IconBuildingCommunity}
    />
  );
}
