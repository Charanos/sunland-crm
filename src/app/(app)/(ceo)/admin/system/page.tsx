"use client";

import { Suspense } from "react";
import { useUIStore } from "@/store/ui";
import { AccountSystemBoard } from "@/components/sunland/account-system-board";

// System Administration = the Account & System console's Organization scope
// (ADR 018 folded the old system-admin-board's users/roles, thresholds and
// audit tabs into Directory & Roles / Access Policies / System). Lands on
// Directory; ?section=policies|system selects the other two org sections,
// which have no nav entry of their own (ADR 019).
export default function SystemAdminPage() {
  const { activeEntityId } = useUIStore();
  return (
    <Suspense fallback={null}>
      <AccountSystemBoard entityId={activeEntityId} startScope="org" startSection="directory" />
    </Suspense>
  );
}
