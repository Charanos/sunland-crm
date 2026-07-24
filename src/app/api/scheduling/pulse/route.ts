import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/authz/errors";
import { getSchedulerPulse } from "@/lib/services/scheduling";
import { requireCallerContext } from "@/lib/services/types";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const ctx = await requireCallerContext(undefined, request);
    const pulse = await getSchedulerPulse(ctx, {
      entityId: searchParams.get("entityId") ?? undefined,
      scope: searchParams.get("scope") === "org" ? "org" : "personal",
    });

    return NextResponse.json({ pulse });
  } catch (error) {
    return handleRouteError(error);
  }
}
