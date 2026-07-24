import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/authz/errors";
import { getDirectoryOverview } from "@/lib/services/account-console";
import { requireCallerContext } from "@/lib/services/types";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const entityId = searchParams.get("entityId") ?? null;
    const ctx = await requireCallerContext(entityId, request);
    const overview = await getDirectoryOverview(ctx);
    return NextResponse.json({ overview });
  } catch (error) {
    return handleRouteError(error);
  }
}
