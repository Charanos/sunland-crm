import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/authz/errors";
import { decideApprovalRequest } from "@/lib/services/finance/approvals";
import { requireCallerContext } from "@/lib/services/types";

export async function POST(request: Request) {
  try {
    // ctx.entityId is a placeholder — decideApprovalRequest derives the real
    // scope from the target approval request's own entityId, not from input.
    const ctx = await requireCallerContext(undefined, request);
    const body = await request.json();

    const updated = await decideApprovalRequest(ctx, body);
    return NextResponse.json({ success: true, request: updated });
  } catch (error) {
    return handleRouteError(error);
  }
}
