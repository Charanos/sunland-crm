import { NextResponse } from "next/server";
import { DomainValidationError, handleRouteError } from "@/lib/authz/errors";
import { terminateLease, getLeaseById, updateLease, renewLease } from "@/lib/services/properties";
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
    // Default to "terminate" for backward compatibility — every existing
    // caller sends only { entityId } and expects the old terminate-only behavior.
    const action = body.action ?? "terminate";

    const ctx = await requireCallerContext(entityId, request);

    let lease;
    if (action === "terminate") {
      lease = await terminateLease(ctx, id);
    } else if (action === "update") {
      lease = await updateLease(ctx, id, body);
    } else if (action === "renew") {
      lease = await renewLease(ctx, id, body);
    } else {
      throw new DomainValidationError(`Unsupported action: ${action}`);
    }

    return NextResponse.json({ success: true, lease });
  } catch (error) {
    return handleRouteError(error);
  }
}
