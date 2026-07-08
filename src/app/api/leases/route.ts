import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/authz/errors";
import { createLease, listLeases } from "@/lib/services/properties";
import { requireCallerContext } from "@/lib/services/types";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const entityId = searchParams.get("entityId") ?? null;

    const ctx = await requireCallerContext(entityId, request);
    const leasesList = await listLeases(ctx);

    return NextResponse.json({ leases: leasesList });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const entityId = body.entityId ?? null;

    const ctx = await requireCallerContext(entityId, request);
    const lease = await createLease(ctx, body);

    return NextResponse.json({ success: true, lease });
  } catch (error) {
    return handleRouteError(error);
  }
}
