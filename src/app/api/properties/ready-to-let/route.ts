import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/authz/errors";
import { listReadyToLetProperties } from "@/lib/services/properties";
import { requireCallerContext } from "@/lib/services/types";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const entityId = searchParams.get("entityId") ?? null;

    const ctx = await requireCallerContext(entityId, request);
    const readyToLet = await listReadyToLetProperties(ctx);

    return NextResponse.json(readyToLet);
  } catch (error) {
    return handleRouteError(error);
  }
}
