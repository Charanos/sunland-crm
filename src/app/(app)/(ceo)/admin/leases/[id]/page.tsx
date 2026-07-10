"use client";

import { useUIStore } from "@/store/ui";
import { LeaseFullViewBoard } from "@/components/sunland/lease-full-view-board";
import { useParams } from "next/navigation";

export default function LeasePage() {
  const { activeEntityId } = useUIStore();
  const params = useParams();
  const leaseId = params.id as string;

  if (!leaseId) return null;

  return <LeaseFullViewBoard entityId={activeEntityId} leaseId={leaseId} />;
}
