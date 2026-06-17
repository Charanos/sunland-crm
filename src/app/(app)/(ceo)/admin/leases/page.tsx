import { IconCalendarDollar } from "@tabler/icons-react";
import { ModulePage } from "@/components/sunland/module-page";

export default function LeasesPage() {
  return (
    <ModulePage
      action="Create lease"
      description="Manage lease terms, rent schedules, renewals, expiries, tenant placement, and arrears signals."
      emptyDescription="Active and upcoming leases will appear here once a tenant is linked to a property."
      emptyTitle="No leases yet"
      eyebrow="Property management"
      icon={IconCalendarDollar}
      title="Leases"
    />
  );
}
