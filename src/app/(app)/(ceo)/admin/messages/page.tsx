"use client";

import { Suspense } from "react";
import { useUIStore } from "@/store/ui";
import { AccountSystemBoard } from "@/components/sunland/account-system-board";

// Renders the Account & System console directly rather than redirecting into
// /admin/account (ADR 019). The sidebar's getActiveNavItem matches on pathname
// and pathnames drop the query string, so this route needs to keep its own
// path for the grouped nav link to highlight correctly.
export default function MessagesPage() {
  const { activeEntityId } = useUIStore();
  return (
    <Suspense fallback={null}>
      <AccountSystemBoard entityId={activeEntityId} startScope="personal" startSection="messages" />
    </Suspense>
  );
}
