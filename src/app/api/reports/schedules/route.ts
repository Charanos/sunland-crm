import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/authz/errors";
import { listRecentReportExports, listReportSchedules, upsertReportSchedule } from "@/lib/services/finance/reports";
import { requireCallerContext } from "@/lib/services/types";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const entityId = searchParams.get("entityId");
    const ctx = await requireCallerContext(entityId, request);

    const [schedules, exports] = await Promise.all([
      listReportSchedules(ctx, entityId ?? undefined),
      listRecentReportExports(ctx, entityId ?? undefined),
    ]);

    return NextResponse.json({ schedules, exports });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const ctx = await requireCallerContext(body?.entityId ?? null, request);
    const schedule = await upsertReportSchedule(ctx, body);

    return NextResponse.json({ success: true, schedule });
  } catch (error) {
    return handleRouteError(error);
  }
}
