import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/authz/errors";
import { signMandateFromValuation } from "@/lib/services/valuations";
import { requireCallerContext } from "@/lib/services/types";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const entityId = body.entityId ?? null;

    const ctx = await requireCallerContext(entityId, request);
    const result = await signMandateFromValuation(ctx, id);

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return handleRouteError(error);
  }
}
