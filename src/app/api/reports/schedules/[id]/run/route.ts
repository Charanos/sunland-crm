import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/authz/errors";
import { runReportSchedule } from "@/lib/services/finance/reports";
import { requireCallerContext } from "@/lib/services/types";

/**
 * Runs a scheduled report immediately. No scheduler exists, so this is how a
 * schedule actually produces output - and it produces a genuine, QR-verifiable
 * report_exports row rather than a simulated one.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await requireCallerContext(undefined, request);
    const result = await runReportSchedule(ctx, id);

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return handleRouteError(error);
  }
}
