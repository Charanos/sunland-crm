"use client";

import { useUIStore } from "@/store/ui";
import { ValuationFullViewBoard } from "@/components/sunland/valuation-full-view-board";
import { useParams } from "next/navigation";

export default function ValuationPage() {
  const { activeEntityId } = useUIStore();
  const params = useParams();
  const valuationId = params.id as string;

  if (!valuationId) return null;

  return <ValuationFullViewBoard entityId={activeEntityId} valuationId={valuationId} />;
}
