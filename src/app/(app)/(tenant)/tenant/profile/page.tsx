import { ModulePage } from "@/components/sunland/module-page";
import { IconUserCircle } from "@tabler/icons-react";
export default function TenantProfilePage() {
  return (
    <ModulePage
      eyebrow="Account"
      title="My Profile"
      description="Your contact information, portal preferences, and notification settings."
      emptyTitle="Profile not yet loaded"
      emptyDescription="Profile management will connect to the identity API once tenant accounts are provisioned."
      action="Edit Profile"
      icon={IconUserCircle}
    />
  );
}
