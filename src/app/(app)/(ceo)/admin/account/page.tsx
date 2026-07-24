"use client";

import { Suspense } from "react";
import { useUIStore } from "@/store/ui";
import { AccountSystemBoard } from "@/components/sunland/account-system-board";

export default function AccountSystemPage() {
  const { activeEntityId } = useUIStore();
  return (
    <Suspense fallback={null}>
      <AccountSystemBoard entityId={activeEntityId} />
    </Suspense>
  );
}
