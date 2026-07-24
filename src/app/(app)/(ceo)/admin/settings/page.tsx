"use client";

import { Suspense } from "react";
import { useUIStore } from "@/store/ui";
import { AccountSystemBoard } from "@/components/sunland/account-system-board";

// Account & System console, Preferences section (ADR 019 - own pathname so
// the grouped sidebar link highlights).
export default function SettingsPage() {
  const { activeEntityId } = useUIStore();
  return (
    <Suspense fallback={null}>
      <AccountSystemBoard entityId={activeEntityId} startScope="personal" startSection="preferences" />
    </Suspense>
  );
}
