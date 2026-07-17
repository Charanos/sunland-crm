import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/authz/errors";
import { generatePnLReport } from "@/lib/services/finance/reports";
import { requireCallerContext } from "@/lib/services/types";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const entityId = body.entityId ?? null;

    const ctx = await requireCallerContext(entityId, request);
    const report = await generatePnLReport(ctx, body);

    return NextResponse.json({ success: true, report });
  } catch (error) {
    return handleRouteError(error);
  }
}
