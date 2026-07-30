import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/authz/errors";
import { getOversightCounts, getOversightPulse } from "@/lib/services/oversight";
import { requireCallerContext } from "@/lib/services/types";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const entityId = searchParams.get("entityId");
    const ctx = await requireCallerContext(entityId, request);

    const [pulse, counts] = await Promise.all([
      getOversightPulse(ctx, entityId ?? undefined),
      getOversightCounts(ctx, entityId ?? undefined),
    ]);

    return NextResponse.json({ pulse, counts });
  } catch (error) {
    return handleRouteError(error);
  }
}
