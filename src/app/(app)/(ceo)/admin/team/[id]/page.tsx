"use client";

import { useUIStore } from "@/store/ui";
import { ManagerFullViewBoard } from "@/components/sunland/manager-full-view-board";
import { useParams } from "next/navigation";

export default function TeamMemberPage() {
  const { activeEntityId } = useUIStore();
  const params = useParams();
  const managerId = params.id as string;

  if (!managerId) return null;

  return <ManagerFullViewBoard entityId={activeEntityId} managerId={managerId} />;
}
