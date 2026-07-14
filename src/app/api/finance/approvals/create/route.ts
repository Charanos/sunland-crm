import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/authz/errors";
import { createApprovalRequest } from "@/lib/services/finance/approvals";
import { requireCallerContext } from "@/lib/services/types";

export async function POST(request: Request) {
  try {
    // ctx.entityId is a placeholder - createApprovalRequest resolves the real
    // entity from the body and authorizes against that, never this value.
    const ctx = await requireCallerContext(undefined, request);
    const body = await request.json();

    const newRequest = await createApprovalRequest(ctx, body);
    return NextResponse.json({ success: true, request: newRequest });
  } catch (error) {
    return handleRouteError(error);
  }
}
