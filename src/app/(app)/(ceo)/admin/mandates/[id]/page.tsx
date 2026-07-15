"use client";

import { useUIStore } from "@/store/ui";
import { MandateFullViewBoard } from "@/components/sunland/mandate-full-view-board";
import { useParams } from "next/navigation";

export default function MandatePage() {
  const { activeEntityId } = useUIStore();
  const params = useParams();
  const mandateId = params.id as string;

  if (!mandateId) return null;

  return <MandateFullViewBoard entityId={activeEntityId} mandateId={mandateId} />;
}
