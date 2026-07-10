import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/authz/errors";
import { terminateLease, getLeaseById } from "@/lib/services/properties";
import { requireCallerContext } from "@/lib/services/types";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const entityId = searchParams.get("entityId");
    
    const ctx = await requireCallerContext(entityId, request);
    const lease = await getLeaseById(ctx, id);

    return NextResponse.json({ lease });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const entityId = body.entityId ?? null;

    const ctx = await requireCallerContext(entityId, request);
    const lease = await terminateLease(ctx, id);

    return NextResponse.json({ success: true, lease });
  } catch (error) {
    return handleRouteError(error);
  }
}
