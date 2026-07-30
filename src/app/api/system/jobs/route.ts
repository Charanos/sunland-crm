import { NextResponse } from "next/server";
import { DomainValidationError, handleRouteError } from "@/lib/authz/errors";
import { listJobs, listRecentJobRuns, runJob } from "@/lib/services/system-ops";
import { requireCallerContext } from "@/lib/services/types";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const entityId = searchParams.get("entityId") ?? "group";
    const ctx = await requireCallerContext(entityId, request);

    const [jobs, recentRuns] = await Promise.all([
      listJobs(ctx, entityId),
      listRecentJobRuns(ctx, entityId),
    ]);

    return NextResponse.json({ jobs, recentRuns });
  } catch (error) {
    return handleRouteError(error);
  }
}

/** "Run now" - executes the registered job for real and records the run. */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const entityId = body?.entityId ?? "group";
    if (!body?.jobKey) throw new DomainValidationError("jobKey is required");

    const ctx = await requireCallerContext(entityId, request);
    const run = await runJob(ctx, entityId, body.jobKey);

    return NextResponse.json({ success: true, run });
  } catch (error) {
    return handleRouteError(error);
  }
}
