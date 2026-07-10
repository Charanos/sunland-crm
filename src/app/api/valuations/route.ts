import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/authz/errors";
import { createValuation, listValuations } from "@/lib/services/valuations";
import { requireCallerContext } from "@/lib/services/types";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const entityId = searchParams.get("entityId") ?? null;

    const ctx = await requireCallerContext(entityId, request);
    const items = await listValuations(ctx);

    return NextResponse.json({ valuations: items });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const entityId = body.entityId ?? null;

    const ctx = await requireCallerContext(entityId, request);
    const valuation = await createValuation(ctx, body);

    return NextResponse.json({ success: true, valuation });
  } catch (error) {
    return handleRouteError(error);
  }
}
