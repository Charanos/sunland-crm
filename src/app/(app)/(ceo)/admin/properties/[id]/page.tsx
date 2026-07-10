"use client";

import { useUIStore } from "@/store/ui";
import { PropertyFullViewBoard } from "@/components/sunland/property-full-view-board";
import { useParams } from "next/navigation";

export default function PropertyPage() {
  const { activeEntityId } = useUIStore();
  const params = useParams();
  const propertyId = params.id as string;

  if (!propertyId) return null;

  return <PropertyFullViewBoard entityId={activeEntityId} propertyId={propertyId} />;
}
