import { IconSettings } from "@tabler/icons-react";
import { ModulePage } from "@/components/sunland/module-page";

export default function SettingsPage() {
  return (
    <ModulePage
      action="Configure workspace"
      description="Manage workspace preferences, CRM defaults, team settings, module visibility, and operational thresholds."
      emptyDescription="Settings panels will appear here as authentication, teams, and module configuration are completed."
      emptyTitle="Workspace settings are ready"
      eyebrow="Administration"
      icon={IconSettings}
      title="Settings"
    />
  );
}
