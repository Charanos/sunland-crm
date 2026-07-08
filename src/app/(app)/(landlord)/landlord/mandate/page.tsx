import { ModulePage } from "@/components/sunland/module-page";
import { IconFileText } from "@tabler/icons-react";
export default function LandlordMandatePage() {
  return (
    <ModulePage
      eyebrow="Your Mandate"
      title="Mandate Terms"
      description="Your current mandate agreement with Sunland � management rate, covered units, term dates, and status. Documents available for download."
      emptyTitle="No mandate on file"
      emptyDescription="Your mandate agreement will appear here once it has been activated by the Sunland Finance team."
      action="Contact Sunland"
      icon={IconFileText}
    />
  );
}
