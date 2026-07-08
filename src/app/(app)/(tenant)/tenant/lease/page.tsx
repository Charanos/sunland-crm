import { ModulePage } from "@/components/sunland/module-page";
import { IconContract } from "@tabler/icons-react";
export default function TenantLeasePage() {
  return (
    <ModulePage
      eyebrow="My Lease"
      title="Lease & Documents"
      description="Your lease terms, start and end dates, deposit amount held, and document downloads. The deposit figure reflects the balance in the Sunland security deposits account — never commingled with operating funds."
      emptyTitle="No lease on file"
      emptyDescription="Your lease details will appear here once your tenancy is activated in the system."
      action="Contact Sunland"
      icon={IconContract}
    />
  );
}
