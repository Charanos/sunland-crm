import { IconShieldLock } from "@tabler/icons-react";
import { ModulePage } from "@/components/sunland/module-page";

export default function SecurityPage() {
  return (
    <ModulePage
      action="Review access"
      description="Manage session policy, role access, audit posture, and production authentication controls."
      emptyDescription="Security controls will appear here after user management and audit logging are wired to the database."
      emptyTitle="Security controls pending"
      eyebrow="Access control"
      icon={IconShieldLock}
      title="Security"
    />
  );
}
