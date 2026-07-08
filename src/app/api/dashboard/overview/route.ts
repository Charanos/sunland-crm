import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/authz/errors";
import { requireCallerContext } from "@/lib/services/types";
import { getDashboardOverview, type ChartPeriod } from "@/lib/services/dashboard";

const VALID_PERIODS: ChartPeriod[] = ["week", "month", "quarter"];

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const entityId = searchParams.get("entityId") ?? null;
    const periodParam = searchParams.get("period");
    const period: ChartPeriod = VALID_PERIODS.includes(periodParam as ChartPeriod)
      ? (periodParam as ChartPeriod)
      : "week";

    const ctx = await requireCallerContext(entityId, request);
    const dashboardData = await getDashboardOverview(ctx, period);

    return NextResponse.json(dashboardData);
  } catch (error) {
    return handleRouteError(error);
  }
}
