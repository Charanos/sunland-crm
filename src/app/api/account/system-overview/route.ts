import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/authz/errors";
import { getIntegrationHealth } from "@/lib/services/account-console";
import { listAuditLog } from "@/lib/services/audit-log";
import { requireCallerContext } from "@/lib/services/types";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const entityId = searchParams.get("entityId") ?? null;
    const ctx = await requireCallerContext(entityId, request);

    const integrations = getIntegrationHealth();
    const audit = await listAuditLog(ctx, { entityId: entityId ?? undefined, limit: 12 });

    return NextResponse.json({
      integrations,
      audit: audit.map((a) => ({ id: a.id, actorName: a.actorName, action: a.action, summary: a.summary, createdAt: a.createdAt })),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
