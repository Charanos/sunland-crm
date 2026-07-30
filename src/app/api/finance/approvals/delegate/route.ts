import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/authz/errors";
import { delegateApprovalRequest } from "@/lib/services/finance/approvals";
import { requireCallerContext } from "@/lib/services/types";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const ctx = await requireCallerContext(body?.entityId ?? null, request);
    const delegated = await delegateApprovalRequest(ctx, body);

    return NextResponse.json({ success: true, approval: delegated });
  } catch (error) {
    return handleRouteError(error);
  }
}
