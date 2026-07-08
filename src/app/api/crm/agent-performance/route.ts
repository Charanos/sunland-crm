import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/authz/errors";
import { getAgentPerformance } from "@/lib/services/agent-performance";
import { requireCallerContext } from "@/lib/services/types";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const entityId = searchParams.get("entityId") ?? null;

    const ctx = await requireCallerContext(entityId, request);
    const agents = await getAgentPerformance(ctx);

    return NextResponse.json({ agents });
  } catch (error) {
    return handleRouteError(error);
  }
}
