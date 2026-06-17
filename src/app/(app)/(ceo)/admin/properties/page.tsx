import { IconBuildingCommunity } from "@tabler/icons-react";
import { ModulePage } from "@/components/sunland/module-page";

export default function PropertiesPage() {
  return (
    <ModulePage
      action="Add property"
      description="Track managed properties, sales inventory, units, occupancy, ownership, listing status, and media assets."
      emptyDescription="Properties added by the sales or property management team will appear here."
      emptyTitle="No properties yet"
      eyebrow="Estate portfolio"
      icon={IconBuildingCommunity}
      title="Properties"
    />
  );
}
