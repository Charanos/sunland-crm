import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/authz/errors";
import { createMaintenanceRequest, listMaintenanceRequests } from "@/lib/services/maintenance";
import { requireCallerContext } from "@/lib/services/types";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const entityId = searchParams.get("entityId") ?? null;
    const status = searchParams.get("status") ?? undefined;
    const priority = searchParams.get("priority") ?? undefined;
    const propertyId = searchParams.get("propertyId") ?? undefined;

    const ctx = await requireCallerContext(entityId, request);
    const maintenanceRequests = await listMaintenanceRequests(ctx, { status, priority, propertyId });

    return NextResponse.json({ maintenanceRequests });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const entityId = body.entityId ?? null;

    const ctx = await requireCallerContext(entityId, request);
    const maintenanceRequest = await createMaintenanceRequest(ctx, body);

    return NextResponse.json({ success: true, maintenanceRequest });
  } catch (error) {
    return handleRouteError(error);
  }
}
