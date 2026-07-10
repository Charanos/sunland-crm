import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/authz/errors";
import { deleteValuation, updateValuation } from "@/lib/services/valuations";
import { requireCallerContext } from "@/lib/services/types";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const entityId = body.entityId ?? null;

    const ctx = await requireCallerContext(entityId, request);
    const valuation = await updateValuation(ctx, id, body);

    return NextResponse.json({ success: true, valuation });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const entityId = searchParams.get("entityId") ?? null;

    const ctx = await requireCallerContext(entityId, request);
    const result = await deleteValuation(ctx, id);

    return NextResponse.json(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
