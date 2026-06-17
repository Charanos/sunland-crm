import { IconBell } from "@tabler/icons-react";
import { ModulePage } from "@/components/sunland/module-page";

export default function NotificationsPage() {
  return (
    <ModulePage
      action="Review alerts"
      description="Review lead, payment, lease, maintenance, and system notifications from the real-time event stream."
      emptyDescription="Unread and historical notifications will appear here once live events are connected."
      emptyTitle="No notifications yet"
      eyebrow="Live awareness"
      icon={IconBell}
      title="Notifications"
    />
  );
}
