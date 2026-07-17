import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/authz/errors";
import { getRevenueStreamBreakdown } from "@/lib/services/finance/reports";
import { requireCallerContext } from "@/lib/services/types";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const entityId = searchParams.get("entityId") ?? "group";
    const periodStart = searchParams.get("periodStart") ?? undefined;
    const periodEnd = searchParams.get("periodEnd") ?? undefined;

    const ctx = await requireCallerContext(entityId, request);
    const breakdown = await getRevenueStreamBreakdown(ctx, entityId, periodStart, periodEnd);

    return NextResponse.json(breakdown);
  } catch (error) {
    return handleRouteError(error);
  }
}
