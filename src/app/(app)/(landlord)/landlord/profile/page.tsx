import { ModulePage } from "@/components/sunland/module-page";
import { IconUserCircle } from "@tabler/icons-react";
export default function LandlordProfilePage() {
  return (
    <ModulePage
      eyebrow="Account"
      title="My Profile"
      description="Your account information, contact details, and portal preferences."
      emptyTitle="Profile not yet loaded"
      emptyDescription="Profile editing will connect to the identity API once landlord accounts are provisioned."
      action="Edit Profile"
      icon={IconUserCircle}
    />
  );
}
