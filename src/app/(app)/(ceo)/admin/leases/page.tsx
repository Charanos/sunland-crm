"use client";

import { useUIStore } from "@/store/ui";
import { LeasesBoard } from "@/components/sunland/leases-board";

export default function LeasesPage() {
  const { activeEntityId } = useUIStore();

  return <LeasesBoard entityId={activeEntityId} />;
}
