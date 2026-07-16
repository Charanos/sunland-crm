import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/authz/errors";
import { generateUnitsFromBreakdown } from "@/lib/services/properties";
import { requireCallerContext } from "@/lib/services/types";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const entityId = body.entityId ?? null;

    const ctx = await requireCallerContext(entityId, request);
    const units = await generateUnitsFromBreakdown(ctx, id);

    return NextResponse.json({ success: true, units });
  } catch (error) {
    return handleRouteError(error);
  }
}
