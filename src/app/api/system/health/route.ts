import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/authz/errors";
import { getServiceHealthHistory, probeServiceHealth } from "@/lib/services/system-ops";
import { requireCallerContext } from "@/lib/services/types";

/** Recorded health history. Days with no probe come back as gaps, not as green. */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    await requireCallerContext(searchParams.get("entityId"), request);
    const services = await getServiceHealthHistory(Number(searchParams.get("days") ?? 30));

    return NextResponse.json({ services });
  } catch (error) {
    return handleRouteError(error);
  }
}

/** Runs the probe now and records the result. */
export async function POST(request: Request) {
  try {
    await requireCallerContext(undefined, request);
    const results = await probeServiceHealth();
    const services = await getServiceHealthHistory(30);

    return NextResponse.json({ success: true, results, services });
  } catch (error) {
    return handleRouteError(error);
  }
}
