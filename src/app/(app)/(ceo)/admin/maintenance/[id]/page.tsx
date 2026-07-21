"use client";

import { useUIStore } from "@/store/ui";
import { MaintenanceFullViewBoard } from "@/components/sunland/maintenance-full-view-board";
import { useParams } from "next/navigation";

export default function MaintenanceRequestPage() {
  const { activeEntityId } = useUIStore();
  const params = useParams();
  const requestId = params.id as string;

  if (!requestId) return null;

  return <MaintenanceFullViewBoard entityId={activeEntityId} requestId={requestId} />;
}
