import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/authz/errors";
import { deleteMaintenanceRequest, updateMaintenanceRequest } from "@/lib/services/maintenance";
import { requireCallerContext } from "@/lib/services/types";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();

    const ctx = await requireCallerContext(null, request);
    const maintenanceRequest = await updateMaintenanceRequest(ctx, id, body);

    return NextResponse.json({ success: true, maintenanceRequest });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const ctx = await requireCallerContext(null, request);
    const result = await deleteMaintenanceRequest(ctx, id);

    return NextResponse.json(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
