"use client";

import { Suspense } from "react";
import { useUIStore } from "@/store/ui";
import { AccountSystemBoard } from "@/components/sunland/account-system-board";

// Account & System console, Notifications section (ADR 019 - own pathname so
// the grouped sidebar link highlights).
export default function NotificationsPage() {
  const { activeEntityId } = useUIStore();
  return (
    <Suspense fallback={null}>
      <AccountSystemBoard entityId={activeEntityId} startScope="personal" startSection="notifications" />
    </Suspense>
  );
}
