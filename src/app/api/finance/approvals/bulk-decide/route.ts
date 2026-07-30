import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/authz/errors";
import { bulkDecideApprovalRequests } from "@/lib/services/finance/approvals";
import { requireCallerContext } from "@/lib/services/types";

/**
 * Decides several approvals in one action. Returns per-item outcomes rather
 * than a single boolean, so the console can report partial success honestly.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const ctx = await requireCallerContext(body?.entityId ?? null, request);
    const result = await bulkDecideApprovalRequests(ctx, body);

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return handleRouteError(error);
  }
}
