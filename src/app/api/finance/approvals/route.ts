import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/authz/errors";
import { listApprovalRequests } from "@/lib/services/finance/approvals";
import { requireCallerContext } from "@/lib/services/types";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const entityId = searchParams.get("entityId") || "group";
    const status = searchParams.get("status") ?? undefined;

    const ctx = await requireCallerContext(entityId, request);
    const requests = await listApprovalRequests(ctx, { entityId, status });

    return NextResponse.json({ requests });
  } catch (error) {
    return handleRouteError(error);
  }
}
