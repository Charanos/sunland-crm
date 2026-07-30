import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/authz/errors";
import { getMaintenanceMode, setMaintenanceMode } from "@/lib/services/system-ops";
import { requireCallerContext } from "@/lib/services/types";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const entityId = searchParams.get("entityId") ?? "group";
    await requireCallerContext(entityId, request);
    const state = await getMaintenanceMode(entityId);

    return NextResponse.json({ maintenance: state });
  } catch (error) {
    return handleRouteError(error);
  }
}

/**
 * Toggling this genuinely gates the app for non-super-admins (proxy.ts reads
 * the same settings row), so it is permission-gated and audited in the service.
 */
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const entityId = body?.entityId ?? "group";
    const ctx = await requireCallerContext(entityId, request);
    const state = await setMaintenanceMode(ctx, entityId, {
      enabled: body?.enabled === true,
      message: typeof body?.message === "string" ? body.message : undefined,
    });

    return NextResponse.json({ success: true, maintenance: state });
  } catch (error) {
    return handleRouteError(error);
  }
}
