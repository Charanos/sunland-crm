import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/authz/errors";
import { listAuditLog } from "@/lib/services/audit-log";
import { requireCallerContext } from "@/lib/services/types";

export async function GET(request: Request) {
  try {
    const ctx = await requireCallerContext(undefined, request);
    const params = new URL(request.url).searchParams;

    const entries = await listAuditLog(ctx, {
      entityId: params.get("entityId") ?? undefined,
      actorId: params.get("actorId") ?? undefined,
      action: params.get("action") ?? undefined,
      associatedType: params.get("associatedType") ?? undefined,
      associatedId: params.get("associatedId") ?? undefined,
      dateFrom: params.get("dateFrom") ?? undefined,
      dateTo: params.get("dateTo") ?? undefined,
      limit: params.get("limit") ? Number(params.get("limit")) : undefined,
      offset: params.get("offset") ? Number(params.get("offset")) : undefined,
    });
    return NextResponse.json({ entries });
  } catch (error) {
    return handleRouteError(error);
  }
}
