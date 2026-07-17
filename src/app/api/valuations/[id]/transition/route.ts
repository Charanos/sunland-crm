import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/authz/errors";
import { transitionValuationStage } from "@/lib/services/valuations";
import { transitionStageSchema } from "@/lib/validation/valuations";
import { parseInput } from "@/lib/validation/parse";
import { requireCallerContext } from "@/lib/services/types";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const entityId = body.entityId ?? null;
    const { stage } = parseInput(transitionStageSchema, body);

    const ctx = await requireCallerContext(entityId, request);
    const valuation = await transitionValuationStage(ctx, id, stage);

    return NextResponse.json({ success: true, valuation });
  } catch (error) {
    return handleRouteError(error);
  }
}
